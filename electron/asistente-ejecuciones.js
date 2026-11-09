const { randomUUID } = require('node:crypto');
const E = require('./asistente-ejecucion-estado');
const { progresoDeFase } = require('./asistente-ejecucion-progreso');
const { reconciliar } = require('./asistente-ejecucion-recuperar');
const { trabajar, avisarDeHallazgos } = require('./asistente-ejecucion-trabajo');

const ACCIONES_DE_EJECUCION = ['startInvestigation', 'cancelInvestigation', 'retryInvestigation'];

const FALLOS = [
  [/límite diario/i, 'limite-diario'], [/comprobaci[oó]n humana|cloudflare|reto/i, 'reto'],
  [/proveedor|deepseek|api key|401|429/i, 'proveedor'], [/tiempo|timeout|agotad/i, 'timeout']
];

const clasificar = mensaje => (FALLOS.find(([r]) => r.test(mensaje)) || [0, 'fuente'])[1];

function crearEjecuciones({ state, services = {}, avisar = () => {}, now = () => Date.now(), id = randomUUID,
  maxConcurrentes = E.MAX_CONCURRENTES, tiempoMaximoMs = E.TIEMPO_MAXIMO_MS, ejecutarTrabajo = trabajar } = {}) {
  const vivas = new Map();
  const finales = new Map();
  const cola = [];
  let enMarcha = 0;

  const publicar = e => avisar('asistente-ejecucion', E.publica(e));
  const esperarFin = ejId => { if (!finales.has(ejId)) { let resolver; const promesa = new Promise(r => { resolver = r; }); finales.set(ejId, { promesa, resolver }); } return finales.get(ejId); };

  async function mover(ejId, fn) {
    let hecha = null;
    await state.update(s => { const e = (s.ejecuciones || []).find(x => x.id === ejId); if (e) { fn(e, s); hecha = { ...e }; } });
    if (hecha) publicar(hecha);
    return hecha;
  }

  function registrar(s, { investigationId, origen, clave, retryOf = null, intento = 1 }) {
    s.ejecuciones ||= [];
    const job = s.investigations.find(j => j.id === investigationId);
    if (!job) throw new Error('Investigación no encontrada.');
    if (clave) { const igual = s.ejecuciones.find(e => e.clave === clave); if (igual) return { ejecucion: igual, existente: true }; }
    const viva = s.ejecuciones.find(e => e.investigationId === investigationId && !E.esTerminal(e.estado));
    if (viva) return { ejecucion: viva, existente: true };
    if (origen !== 'periodica') {
      if (job.status === 'closed') throw new Error('Esa investigación está cerrada: reábrela para investigar.');
      if (s.settings.paused) throw new Error('El asistente está en pausa.');
      const dia = new Date(now()).toISOString().slice(0, 10);
      const hoy = s.ejecuciones.filter(e => e.origen !== 'periodica' && new Date(e.createdAt).toISOString().slice(0, 10) === dia).length;
      if (hoy >= E.EJECUCIONES_AL_DIA) throw new Error(`Se ha alcanzado el límite diario de investigaciones lanzadas a mano (${E.EJECUCIONES_AL_DIA}). Mañana vuelve a estar disponible.`);
    }
    const ej = E.nueva({ id: id(), investigationId, origen, clave, retryOf, intento }, now());
    s.ejecuciones.push(ej);
    s.ejecuciones = E.recortar(s.ejecuciones);
    return { ejecucion: ej, existente: false };
  }

  async function crear(datos) {
    let r;
    await state.update(s => { r = registrar(s, datos); r = { ...r, ejecucion: { ...r.ejecucion } }; });
    if (r.existente) return { ejecucion: E.publica(r.ejecucion), yaEnCurso: !E.esTerminal(r.ejecucion.estado) };
    esperarFin(r.ejecucion.id);
    publicar(r.ejecucion);
    encolar(r.ejecucion.id);
    return { ejecucion: E.publica(r.ejecucion), yaEnCurso: false };
  }

  function encolar(ejId) { cola.push(ejId); despachar(); }
  function despachar() {
    while (enMarcha < maxConcurrentes && cola.length) { enMarcha++; correr(cola.shift()).catch(e => console.error('[asistente] ejecución sin cerrar:', e.message)).finally(() => { enMarcha--; despachar(); }); }
  }

  async function terminar(ejId, estado, cambios, nuevas = 0) {
    const e = await mover(ejId, (x, s) => {
      if (E.esTerminal(x.estado)) return;
      E.pasar(x, estado, cambios, now());
      if (nuevas) avisarDeHallazgos(s, x.investigationId, nuevas);
      const job = s.investigations.find(j => j.id === x.investigationId);
      if (job && estado === 'fallida') job.errors = [cambios.error.mensaje];
    });
    finales.get(ejId)?.resolver(e);
    return e;
  }

  async function correr(ejId) {
    const control = new AbortController();

    vivas.set(ejId, { controller: control });
    const parcial = { nuevas: 0, total: 0, errores: [], sinConsultar: [] };
    let reloj = null, caducada = false;
    try {
      let job = null, origen = null;
      await mover(ejId, (e, s) => {
        if (e.estado !== 'pendiente') return;
        job = JSON.parse(JSON.stringify(s.investigations.find(j => j.id === e.investigationId) || null));
        origen = e.origen;
        E.pasar(e, 'ejecutando', { progreso: progresoDeFase('preparando', job?.kind) }, now());
      });
      if (!job) return;
      reloj = setTimeout(() => { caducada = true; control.abort(); }, tiempoMaximoMs);
      await ejecutarTrabajo({ job, services, state, signal: control.signal, origen, parcial,
        fase: nombre => mover(ejId, e => { if (!E.esTerminal(e.estado)) Object.assign(e, { fase: nombre, progreso: progresoDeFase(nombre, job.kind), updatedAt: now() }); }) });
      const resumen = { ...parcial, parcial: control.signal.aborted };
      await terminar(ejId, control.signal.aborted ? 'cancelada' : 'completada', { fase: 'terminada', resultado: resumen,
        progreso: progresoDeFase('terminada', job.kind) }, parcial.nuevas);
    } catch (err) {
      const resultado = { ...parcial, parcial: true };
      if (control.signal.aborted && !caducada) await terminar(ejId, 'cancelada', { resultado }, parcial.nuevas);
      else await terminar(ejId, 'fallida', { resultado, error: { tipo: caducada ? 'timeout' : clasificar(err.message),
        mensaje: caducada ? 'La investigación tardó demasiado y se detuvo. Lo encontrado hasta entonces se conserva.' : err.message } }, parcial.nuevas);
    } finally { clearTimeout(reloj); vivas.delete(ejId); finales.get(ejId)?.resolver(null); }
  }

  async function cancelar(ejId) {
    let previo = null;
    const e = await mover(ejId, x => {
      previo = x.estado;
      if (E.esTerminal(x.estado) || x.estado === 'cancelando') return;
      E.pasar(x, x.estado === 'pendiente' ? 'cancelada' : 'cancelando', {}, now());
    });
    if (!e) throw new Error('Ejecución no encontrada.');
    if (previo === 'pendiente') { const i = cola.indexOf(ejId); if (i >= 0) cola.splice(i, 1); finales.get(ejId)?.resolver(e); }
    else vivas.get(ejId)?.controller.abort();
    return { ejecucion: E.publica(e), sinEfecto: E.esTerminal(previo) };
  }

  async function reintentar(ejId, clave = null) {
    const s = await state.read();
    const base = (s.ejecuciones || []).find(e => e.id === ejId);
    if (!base) throw new Error('Ejecución no encontrada.');
    if (!E.esTerminal(base.estado) || base.estado === 'completada') throw new Error('Sólo se reintenta una ejecución que falló, se interrumpió o se canceló.');
    if (base.intento >= E.MAX_INTENTOS) throw new Error(`Ya se ha reintentado ${E.MAX_INTENTOS - 1} veces: revisa los errores o cambia la investigación.`);
    return crear({ investigationId: base.investigationId, origen: base.origen === 'periodica' ? 'escritorio' : base.origen, clave, retryOf: base.id, intento: base.intento + 1 });
  }

  async function recuperar() {
    let r;
    await state.update(s => { r = reconciliar(s, now()); });
    const s = await state.read();
    for (const e of s.ejecuciones.filter(x => r.cambiadas.includes(x.id))) publicar(e);
    for (const ejId of r.relanzar) { esperarFin(ejId); encolar(ejId); }
    return r;
  }

  async function ver({ investigationId = null } = {}) {
    const s = await state.read();
    const lista = (s.ejecuciones || []).filter(e => !investigationId || e.investigationId === investigationId);
    return { ahora: now(), ejecuciones: lista.sort((a, b) => b.updatedAt - a.updatedAt).map(E.publica),
      limites: { concurrentes: maxConcurrentes, alDia: E.EJECUCIONES_AL_DIA, reintentos: E.MAX_INTENTOS } };
  }

  async function accion(action, args = {}, { desdeElMovil = false } = {}) {
    const clave = typeof args.clave === 'string' && args.clave ? args.clave.slice(0, 80) : null;
    if (action === 'startInvestigation') return crear({ investigationId: String(args.id || ''), origen: desdeElMovil ? 'movil' : 'escritorio', clave });
    if (action === 'cancelInvestigation') return cancelar(String(args.executionId || ''));
    if (action === 'retryInvestigation') return reintentar(String(args.executionId || ''), clave);
    throw new Error('Acción no disponible.');
  }

  return { iniciar: crear, cancelar, reintentar, recuperar, ver, accion,
    esperar: ejId => (finales.get(ejId)?.promesa ?? Promise.resolve(null)), get enMarcha() { return enMarcha; } };
}

module.exports = { crearEjecuciones, ACCIONES_DE_EJECUCION, clasificar };
