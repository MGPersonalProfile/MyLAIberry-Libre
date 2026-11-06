const BD_VIAJE = 'mylaiberry-viaje-1';

const PRESUPUESTO_VIAJE_MS = 240000;
let viajeEnCurso = null;

const viajeCancelado = new Set();

function abrirViaje() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD_VIAJE, 3);

    r.onupgradeneeded = (e) => {
      const antes = (e && e.oldVersion) || 0;
      if (antes < 1) {
        r.result.createObjectStore('obras', { keyPath: 'id' });
        r.result.createObjectStore('capitulos', { keyPath: ['obra', 'indice'] });
      }
      if (antes < 2) r.result.createObjectStore('sesiones', { keyPath: 'sessionId' });
      if (antes < 3) r.result.createObjectStore('traducciones', { keyPath: ['obra', 'indice', 'idioma'] });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function leerViaje(almacen, clave) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, 'readonly');
    const r = tx.objectStore(almacen).get(clave);
    r.onsuccess = () => ok(r.result || null);
    r.onerror = () => mal(r.error);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Lectura local interrumpida.')); };
  });
}

async function escribirViaje(almacen, valor) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, 'readwrite');
    tx.objectStore(almacen).put(valor);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Guardado local interrumpido.')); };
  });
}

async function obrasDeViaje(almacen = 'obras') {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, 'readonly');
    const r = tx.objectStore(almacen).getAll();
    r.onsuccess = () => ok(r.result || []);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
  });
}

const CANAL_SESIONES = 'registrar-sesion-lectura';
const sesionesPendientes = () => obrasDeViaje('sesiones');
let enviandoSesiones = null;

async function quitarSesion(id) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('sesiones', 'readwrite');
    tx.objectStore('sesiones').delete(id);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Borrado local interrumpido.')); };
  });
}

async function enviarSesionesAhora(forzar) {
  if (!forzar && pcNoContesta()) return;
  for (const sesion of await sesionesPendientes()) {
    let r;
    try { r = await vigilar(llamarAlPC(CANAL_SESIONES, [sesion])); } catch { return; }
    const ack = r.cuerpo?.valor;
    if (r.estado !== 200 || r.cuerpo?.error || !ack) return;
    if (ack.aceptada === true || ack.motivo === 'no-valida') await quitarSesion(sesion.sessionId);
  }
}

function enviarSesiones(forzar = false) {
  enviandoSesiones ||= enviarSesionesAhora(forzar).finally(() => { enviandoSesiones = null; });
  return enviandoSesiones;
}

async function atenderSesion(peticion, trabajos) {
  const [sesion] = await peticion.clone().json().catch(() => []);
  if (!sesion || typeof sesion.sessionId !== 'string') return json({ error: 'Sesión no válida.' }, 400);
  await escribirViaje('sesiones', sesion);
  trabajos.push(enviarSesiones().catch(() => {}));
  return json({ valor: { aceptada: true, encolada: true } });
}

async function borrarViaje(id) {
  const estado = await leerViaje('obras', id);
  if (!estado) return;
  const bd = await abrirViaje();
  await new Promise((ok, mal) => {
    const tx = bd.transaction(['obras', 'capitulos', 'traducciones'], 'readwrite');
    tx.objectStore('obras').delete(id);
    for (let i = 0; i < (estado.almacenados || estado.total); i++) tx.objectStore('capitulos').delete([id, i]);

    tx.objectStore('traducciones').delete(IDBKeyRange.bound([id], [id, []]));
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Borrado local interrumpido.')); };
  });
}

async function avisarViaje(id, estado) {

  const sinFicha = estado && (({ ficha, ...resto }) => resto)(estado);
  for (const c of await self.clients.matchAll()) c.postMessage({ tipo: 'viaje-estado', id, estado: sinFicha });
}

const fichaDeViaje = (f, id) => f && typeof f === 'object' && String(f.id) === id ? JSON.parse(JSON.stringify(f)) : null;

async function lasGuardadas() {
  return (await obrasDeViaje().catch(() => [])).filter(o => o?.ficha).map(o => o.ficha);
}

async function conLoGuardado(canal, args, cuerpo) {
  if (!['get-library', 'get-work', 'get-fanfic'].includes(canal)) return false;
  const fichas = await lasGuardadas();
  if (canal === 'get-library') {
    const lista = Array.isArray(cuerpo.valor) ? cuerpo.valor : [];
    const ids = new Set(lista.map(o => String(o?.id)));
    const faltan = fichas.filter(f => !ids.has(String(f.id)));
    if (!faltan.length) return false;
    cuerpo.valor = [...lista, ...faltan];
    return true;
  }
  if (cuerpo.valor) return false;
  const ficha = fichas.find(f => String(f.id) === String(args?.[0]));
  if (!ficha) return false;
  cuerpo.valor = ficha;
  return true;
}

async function prepararViaje(id, total, forzar, ficha = null) {
  const anterior = await leerViaje('obras', id);
  const idioma = await idiomaElegido();
  const reintentarHuecos = !!anterior?.faltantes?.length && !anterior.continuar;
  const desde = forzar || reintentarHuecos ? 0
    : anterior?.total === total ? anterior.guardados || 0
      : anterior?.completa && anterior.total < total ? anterior.total : 0;
  const estado = { id, total, guardados: desde, completa: false, continuar: true,
    revisionPendiente: forzar || !!anterior?.revisionPendiente,
    faltantes: forzar || reintentarHuecos ? [] : anterior?.faltantes || [],
    almacenados: Math.max(total, anterior?.almacenados || anterior?.total || 0),
    ficha: ficha || anterior?.ficha || null, ...(idioma ? { idioma } : {}) };
  await escribirViaje('obras', estado);
  return estado;
}

async function traerCapituloViaje(id, indice) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const { estado, cuerpo } = await llamarAlPC('get-chapter-content', [id, indice]);
      if (estado === 200) {
        const html = cuerpo?.valor;
        return typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim() ? html : null;
      }
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(`No se pudo traer el capítulo ${indice + 1} del PC. Se reanudará al reconectar.`);
}

const idiomaElegido = async () => { const a = await ajustesGuardados(); return a.readTranslated && typeof a.lang === 'string' ? a.lang : null; };
const textoDe = html => typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim() ? html : null;

async function preguntarAlPC(canal, args, que) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const { estado, cuerpo } = await llamarAlPC(canal, args);
      if (estado === 200 && !cuerpo?.error) return cuerpo?.valor;
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(`No se pudo traer ${que} del PC. Se reanudará al reconectar.`);
}

async function traducirParaViaje(estado, indice) {
  const { id, idioma } = estado;
  if (!estado.revisionPendiente && await leerViaje('traducciones', [id, indice, idioma])) return;
  const nombre = `la traducción del capítulo ${indice + 1}`;
  if (!await preguntarAlPC('has-translation', [id, indice, idioma], nombre)) return;
  const html = textoDe(await preguntarAlPC('translate-chapter', [id, indice, idioma], nombre));
  if (html) await escribirViaje('traducciones', { obra: id, indice, idioma, html });
}

async function fijarTraduccionLeida(args, html) {
  const id = String(args[0]), estado = await leerViaje('obras', id).catch(() => null);
  if (!estado || !textoDe(html) || !Number.isInteger(args[1])) return;
  await escribirViaje('traducciones', { obra: id, indice: args[1], idioma: args[2], html });
  if (!viajeEnCurso && estado.idioma !== args[2]) await escribirViaje('obras', { ...estado, idioma: args[2] });
}

async function fijadoDe(canal, args) {
  const id = String(args?.[0]);
  if (canal === 'get-chapter-content') {
    const c = await leerViaje('capitulos', [id, args[1]]).catch(() => null);
    return c ? { valor: c.html } : null;
  }
  if ((canal === 'has-translation' || canal === 'translate-chapter') && typeof args?.[2] === 'string') {
    const t = await leerViaje('traducciones', [id, args[1], args[2]]).catch(() => null);
    return t ? { valor: canal === 'has-translation' ? true : t.html } : null;
  }
  return null;
}

async function descargarTramoViaje(estado) {
  const fin = Math.min(estado.total, estado.guardados + 12);
  for (let i = estado.guardados; i < fin; i++) {
    if (viajeCancelado.has(estado.id)) break;
    if (estado.revisionPendiente || !await leerViaje('capitulos', [estado.id, i])) {
      const html = await traerCapituloViaje(estado.id, i);
      if (html) {
        await escribirViaje('capitulos', { obra: estado.id, indice: i, html });
        await (await caches.open(CACHE)).delete(claveDe('get-chapter-content', [estado.id, i]));
      } else estado.faltantes.push(i);
    }
    if (estado.idioma) await traducirParaViaje(estado, i);
    estado.guardados = i + 1;
    await escribirViaje('obras', { ...estado });
    if (i % 5 === 4) await avisarViaje(estado.id, { ...estado, enCurso: true });
  }
  return cerrarTramo(estado);
}

async function cerrarTramo(estado) {
  estado.continuar = estado.guardados < estado.total;
  if (!estado.continuar && estado.faltantes.length) {
    const numeros = estado.faltantes.slice(0, 3).map(i => i + 1).join(', ');
    estado.error = estado.faltantes.length === 1
      ? `Falta el capítulo ${numeros} en el PC; descárgalo allí y reintenta.`
      : `Faltan capítulos ${numeros} en el PC; descárgalos allí y reintenta.`;
  } else if (!estado.continuar) {
    estado.completa = true;
    estado.revisionPendiente = false;
  }
  await escribirViaje('obras', { ...estado });
  return estado;
}

const idDeFondo = id => `viaje-${id}`;
const fondoDe = async id => (await self.registration.backgroundFetch?.get(idDeFondo(id)).catch(() => null)) || null;

async function traducirLoGuardado(estado) {
  if (!estado.idioma || estado.guardados < estado.total) return null;
  for (let i = 0; i < estado.total; i++) {
    try { await traducirParaViaje(estado, i); } catch (e) { estado.guardados = i; return e.message; }
  }
  return null;
}

async function recogerFondo(registro) {
  const id = String(registro.id).replace(/^viaje-/, '');
  const estado = await leerViaje('obras', id).catch(() => null);
  if (!estado) return;
  const porIndice = new Map();
  for (const r of await registro.matchAll()) porIndice.set(Number(new URL(r.request.url).pathname.split('/').pop()), r);
  for (let i = estado.guardados; i < estado.total; i++) {
    const r = porIndice.get(i);
    if (!r && (estado.revisionPendiente || !await leerViaje('capitulos', [id, i]))) break;
    if (r) {
      const respuesta = await r.responseReady.catch(() => null);
      const html = respuesta?.ok ? (await respuesta.json().catch(() => null))?.valor : null;
      if (typeof html !== 'string' || !html.replace(/<[^>]*>/g, '').trim()) break;
      await escribirViaje('capitulos', { obra: id, indice: i, html });
      await (await caches.open(CACHE)).delete(claveDe('get-chapter-content', [id, i]));
    }
    estado.guardados = i + 1;
  }
  estado.enFondo = false;
  const fallo = await traducirLoGuardado(estado);
  await cerrarTramo(estado);
  if (fallo) await escribirViaje('obras', Object.assign(estado, { completa: false, continuar: true, error: fallo, reintentarAlConectar: true }));
  return avisarViaje(id, { ...estado, enCurso: false, terminada: !!estado.completa });
}

for (const tipo of ['backgroundfetchsuccess', 'backgroundfetchfail', 'backgroundfetchabort'])
  self.addEventListener(tipo, e => e.waitUntil(recogerFondo(e.registration)));
self.addEventListener('backgroundfetchclick', e => e.waitUntil(self.clients.openWindow?.(`${BASE}/app/`)));

async function descargarViaje(id, total, forzar = false, ficha = null) {
  if (viajeEnCurso) {

    if (viajeEnCurso !== id) await prepararViaje(id, total, forzar, ficha).catch(() => {});
    const guardado = await leerViaje('obras', id).catch(() => null);
    return avisarViaje(id, guardado && { ...guardado, enCurso: viajeEnCurso === id,
      esperandoOtraObra: viajeEnCurso !== id });
  }
  viajeEnCurso = id;

  if (await fondoDe(id)) {
    viajeEnCurso = null;
    if (viajeCancelado.delete(id)) {
      await (await fondoDe(id))?.abort().catch(() => {});
      await borrarViaje(id).catch(() => {});
      return avisarViaje(id, null);
    }
    const guardado = await leerViaje('obras', id).catch(() => null);
    return avisarViaje(id, guardado && { ...guardado, enCurso: true, enFondo: true });
  }
  let salida;

  let agotado = false;
  const reloj = setTimeout(() => { agotado = true; }, PRESUPUESTO_VIAJE_MS);
  try {
    let estado = await descargarTramoViaje(await prepararViaje(id, total, forzar, ficha));
    while (estado.continuar && !agotado && !viajeCancelado.has(id)) estado = await descargarTramoViaje(estado);
    salida = estado;
  }
  catch (e) {
    const estado = await leerViaje('obras', id).catch(() => null);
    const cuota = e.name === 'QuotaExceededError';
    const error = cuota ? 'No queda espacio para guardar esta obra en el móvil.'
      : e.message || 'No se pudo guardar la obra. Reintenta al reconectar.';
    salida = { id, total, guardados: 0, ...estado, continuar: false, enCurso: false, error,
      reintentarAlConectar: !cuota };
    await escribirViaje('obras', salida).catch(() => {});
  } finally { clearTimeout(reloj); viajeEnCurso = null; }
  if (viajeCancelado.delete(id)) {
    await borrarViaje(id).catch(() => {});
    return avisarViaje(id, null);
  }

  return avisarViaje(id, { ...salida, enCurso: false, terminada: !!salida.completa });
}

const pendienteDeViaje = (o, conectado) => !!o && !o.completa
  && ((o.continuar ?? (o.guardados || 0) < o.total) && !o.error || conectado && !!o.reintentarAlConectar);

async function reanudarViaje(conectado) {
  if (viajeEnCurso) return;
  const pendiente = (await obrasDeViaje()).find(o => pendienteDeViaje(o, conectado));
  if (pendiente) return descargarViaje(pendiente.id, pendiente.total);
}

async function mensajeViaje(d) {
  if (d.tipo === 'viaje-reanudar') {
    const sesiones = enviarSesiones(d.conectado === true).catch(() => {});
    await reanudarViaje(d.conectado === true);
    return sesiones;
  }
  const id = d.id;
  if (typeof id !== 'string' || !/^[\w.-]{1,160}$/.test(id)) return;
  if (d.tipo === 'viaje-estado') {
    const estado = await leerViaje('obras', id);
    return avisarViaje(id, estado && { ...estado, enCurso: viajeEnCurso === id });
  }

  if (d.tipo === 'viaje-seguir') {
    const estado = await leerViaje('obras', id).catch(() => null);
    return pendienteDeViaje(estado, true) ? descargarViaje(id, estado.total) : undefined;
  }
  if (d.tipo === 'viaje-borrar') {
    if (viajeEnCurso === id) {
      viajeCancelado.add(id);
      const estado = await leerViaje('obras', id).catch(() => null);
      return avisarViaje(id, { ...estado, enCurso: true, cancelando: true });
    }
    try {
      await (await fondoDe(id))?.abort().catch(() => {});
      await borrarViaje(id);
      return avisarViaje(id, null);
    } catch {
      const estado = await leerViaje('obras', id).catch(() => null);
      return avisarViaje(id, { ...estado, error: 'No se pudo borrar la copia del móvil.' });
    }
  }

  const ficha = fichaDeViaje(d.ficha, id);
  if (d.tipo === 'viaje-fondo' && Number.isInteger(d.total) && d.total > 0 && d.total <= 20000) {
    const estado = { ...await prepararViaje(id, d.total, false, ficha), enFondo: true };
    await escribirViaje('obras', estado);
    return avisarViaje(id, { ...estado, enCurso: true });
  }
  if (['viaje-guardar', 'viaje-refrescar'].includes(d.tipo)
    && Number.isInteger(d.total) && d.total > 0 && d.total <= 20000)
    return descargarViaje(id, d.total, d.tipo === 'viaje-refrescar', ficha);
}
