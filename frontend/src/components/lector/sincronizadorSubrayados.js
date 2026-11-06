const PLAZO_MS = 8000;
const vacio = () => ({ items: {}, cursor: 0, pendientes: [], conflictos: {} });

const conPlazo = (promesa, ms) => new Promise((ok, mal) => {
  const t = setTimeout(() => mal(new Error('plazo')), ms);
  promesa.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); mal(e); });
});

function reflejar(items, op, ahora) {
  const actual = items[op.anotacionId];
  if (op.accion === 'crear') {
    items[op.anotacionId] = { id: op.anotacionId, capitulo: op.cambios.ancla.capitulo, ancla: op.cambios.ancla,
      tipo: 'subrayado', color: 'amarillo', nota: '', ...op.cambios, autorAparato: op.aparatoId,
      creadoEn: ahora, modificadoEn: ahora, revision: 0, eliminado: false, local: true };
  } else if (actual) {
    items[op.anotacionId] = { ...actual, ...(op.cambios || {}), modificadoEn: ahora, local: true,
      eliminado: op.accion === 'borrar' ? true : op.accion === 'restaurar' ? false : actual.eliminado };
  }
}

function mezclar(guardado, mio, retiradas, resueltos) {
  if (!guardado) return mio;
  const mias = new Set(mio.pendientes.map(p => p.operacionId));
  const ajenas = (guardado.pendientes || []).filter(p => !mias.has(p.operacionId) && !retiradas.has(p.operacionId));
  const pendientes = [...ajenas, ...mio.pendientes];
  const items = { ...(guardado.items || {}) };
  for (const [id, a] of Object.entries(mio.items)) {
    const g = items[id];
    if (!g || mio.pendientes.some(p => p.anotacionId === id) || (a.revision || 0) >= (g.revision || 0)) items[id] = a;
  }
  const conflictos = { ...mio.conflictos };
  for (const [id, c] of Object.entries(guardado.conflictos || {})) if (!resueltos.has(id) && !(id in conflictos)) conflictos[id] = c;
  return { ...mio, items, pendientes, conflictos, cursor: Math.max(mio.cursor || 0, guardado.cursor || 0) };
}

export function crearSincronizador({ api, almacen, obra, ahora = Date.now, plazo = PLAZO_MS }) {
  let estado = null;
  let cola = Promise.resolve();
  const enSerie = tarea => { const p = cola.then(tarea); cola = p.catch(() => {}); return p; };
  const clave = String(obra);
  const retiradas = new Set(), resueltos = new Set();
  const actualizar = almacen.actualizar
    ? f => almacen.actualizar(clave, f)
    : async f => { const m = f(await almacen.leer(clave)); await almacen.guardar(clave, m); return m; };
  const guardar = async () => { estado = await actualizar(guardado => mezclar(guardado, estado, retiradas, resueltos)); };

  const quitar = cual => {
    const fuera = estado.pendientes.filter(cual);
    for (const p of fuera) retiradas.add(p.operacionId);
    estado.pendientes = estado.pendientes.filter(p => !cual(p));
    return fuera;
  };
  const cargar = async () => { estado ||= { ...vacio(), ...(await almacen.leer(clave)) }; return estado; };

  const vista = () => Object.values(estado.items).map(a => (estado.conflictos[a.id]
    ? { ...a, conflicto: estado.conflictos[a.id] } : a));

  async function confirmar(op, anotacion, revision) {
    quitar(p => p.operacionId === op.operacionId);

    for (const p of estado.pendientes) if (p.tras === op.operacionId && Number.isInteger(revision)) {
      p.revisionBase = revision; delete p.tras;
    }
    if (anotacion) estado.items[anotacion.id] = anotacion;
  }

  async function drenarAhora() {
    await cargar();
    while (estado.pendientes.length) {
      const op = estado.pendientes[0];
      if (estado.conflictos[op.anotacionId]) {
        (estado.conflictos[op.anotacionId].cadena ||= []).push(...quitar(p => p.operacionId === op.operacionId)); continue;
      }
      let r;
      try { r = await conPlazo(api.operarSubrayado(clave, op), plazo); } catch { break; }
      if (r?.status === 'ok') await confirmar(op, r.anotacion, r.revision);
      else if (r?.status === 'conflict') {

        const cadena = quitar(p => p.anotacionId === op.anotacionId).filter(p => p.operacionId !== op.operacionId);
        estado.conflictos[op.anotacionId] = { op, actual: r.actual || null, motivo: r.motivo, cadena };
        if (r.actual) estado.items[r.actual.id] = r.actual;
      } else if (r?.status === 'error') {
        quitar(p => p.anotacionId === op.anotacionId);
      } else break;
      await guardar();
    }
    await guardar();
  }

  async function traerAhora() {
    await cargar();
    let r;
    try { r = await conPlazo(api.listarSubrayados(clave, estado.cursor), plazo); } catch { return false; }
    if (r?.status !== 'ok') return false;
    for (const a of r.anotaciones) {

      if (!estado.pendientes.some(p => p.anotacionId === a.id) && !estado.conflictos[a.id]) estado.items[a.id] = a;
      else if (estado.conflictos[a.id]) estado.conflictos[a.id].actual = a;
    }
    estado.cursor = Math.max(estado.cursor, r.revision || 0);
    await guardar();
    return true;
  }

  return {

    leer: () => enSerie(async () => { await cargar(); return { anotaciones: vista(), pendientes: estado.pendientes.length }; }),

    operar: op => enSerie(async () => {
      await cargar();
      const previa = [...estado.pendientes].reverse().find(p => p.anotacionId === op.anotacionId);
      const nueva = previa ? { ...op, tras: previa.operacionId } : { ...op };
      reflejar(estado.items, nueva, ahora());
      estado.pendientes.push(nueva);
      await guardar();
      return nueva;
    }),

    sincronizar: () => enSerie(async () => {
      await drenarAhora();
      const traido = await traerAhora();
      return { anotaciones: vista(), pendientes: estado.pendientes.length, conectado: traido };
    }),

    resolver: (id, quien) => enSerie(async () => {
      await cargar();
      const c = estado.conflictos[id];
      if (!c) return null;
      delete estado.conflictos[id];
      resueltos.add(id);
      if (quien === 'mia' && c.actual) {
        const accion = c.actual.eliminado ? 'restaurar' : c.op.accion === 'restaurar' ? 'editar' : c.op.accion;
        const base = { ...c.op, operacionId: `${c.op.operacionId}-r${c.actual.revision}`, revisionBase: c.actual.revision, accion };
        delete base.tras;
        if (accion === 'restaurar' && c.op.accion === 'editar') {

          const restaurar = { ...base, operacionId: `${base.operacionId}-a`, accion: 'restaurar', cambios: {} };
          const editar = { ...base, accion: 'editar', tras: restaurar.operacionId };
          estado.pendientes.push(restaurar, editar);
        } else estado.pendientes.push(base);
        reflejar(estado.items, base, ahora());
        let previa = base.operacionId;
        for (const p of c.cadena || []) {
          const q = { ...p, operacionId: `${p.operacionId}-r${c.actual.revision}`, tras: previa };
          delete q.revisionBase;
          estado.pendientes.push(q); reflejar(estado.items, q, ahora()); previa = q.operacionId;
        }
      }
      await guardar();
      return true;
    })
  };
}
