const BD_VIAJE = 'mylaiberry-viaje-1';

const PRESUPUESTO_VIAJE_MS = 240000;
let viajeEnCurso = null;

const viajeCancelado = new Set();

function abrirViaje() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD_VIAJE, 6);

    r.onupgradeneeded = (e) => {
      const antes = (e && e.oldVersion) || 0;
      if (antes < 1) {
        r.result.createObjectStore('obras', { keyPath: 'id' });
        r.result.createObjectStore('capitulos', { keyPath: ['obra', 'indice'] });
      }
      if (antes < 2) r.result.createObjectStore('sesiones', { keyPath: 'sessionId' });
      if (antes < 3) r.result.createObjectStore('traducciones', { keyPath: ['obra', 'indice', 'idioma'] });
      if (antes < 4) r.result.createObjectStore('imagenes', { keyPath: ['obra', 'capitulo', 'imagen'] });
      if (antes < 5) {
        r.result.createObjectStore('propuestas', { keyPath: 'id' });
        r.result.createObjectStore('decisiones_propuestas', { keyPath: 'id' });
      }
      if (antes < 6) { r.result.createObjectStore('audios', { keyPath: ['obra', 'indice', 'idioma'] }); r.result.createObjectStore('audioDatos', { keyPath: ['obra', 'indice', 'idioma'] }); }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function enViaje(almacen, modo, hacer) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, modo);
    const r = hacer(tx.objectStore(almacen));
    let valor;

    if (r) r.onsuccess = () => { valor = r.result; if (modo === 'readonly') ok(valor); };
    tx.oncomplete = () => { bd.close(); ok(valor); };
    tx.onerror = () => { bd.close(); mal(tx.error || r?.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Operación local interrumpida.')); };
  });
}
async function leerViaje(almacen, clave) { return (await enViaje(almacen, 'readonly', s => s.get(clave))) || null; }
async function escribirViaje(almacen, valor) { await enViaje(almacen, 'readwrite', s => s.put(valor)); }
async function obrasDeViaje(almacen = 'obras') { return (await enViaje(almacen, 'readonly', s => s.getAll())) || []; }

const CANAL_SESIONES = 'registrar-sesion-lectura';
const sesionesPendientes = () => obrasDeViaje('sesiones');
let enviandoSesiones = null;

async function quitarSesion(id) { await enViaje('sesiones', 'readwrite', s => s.delete(id)); }

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
let forzarPendiente = false;

function enviarSesiones(forzar = false) {
  if (forzar && enviandoSesiones) forzarPendiente = true;
  enviandoSesiones ||= (async () => {
    try { await enviarSesionesAhora(forzar); }
    finally {
      enviandoSesiones = null;
      if (forzarPendiente) { forzarPendiente = false; await enviarSesiones(true); }
    }
  })();
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
  const bd = await abrirViaje();
  await new Promise((ok, mal) => {
    const tx = bd.transaction(['obras', 'capitulos', 'traducciones', 'imagenes', 'audios', 'audioDatos'], 'readwrite');
    tx.objectStore('obras').delete(id);

    tx.objectStore('capitulos').delete(IDBKeyRange.bound([id], [id, []]));

    tx.objectStore('traducciones').delete(IDBKeyRange.bound([id], [id, []]));
    tx.objectStore('imagenes').delete(IDBKeyRange.bound([id], [id, []]));
    tx.objectStore('audios').delete(IDBKeyRange.bound([id], [id, []]));
    tx.objectStore('audioDatos').delete(IDBKeyRange.bound([id], [id, []]));
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Borrado local interrumpido.')); };
  });
}

async function contarViaje(id, total) {
  const rango = IDBKeyRange.bound([id], [id, []]);
  const claves = await enViaje('capitulos', 'readonly', s => s.getAllKeys ? s.getAllKeys(rango) : s.getAll(rango)) || [];
  const hay = new Set(claves.map(c => Array.isArray(c) ? c : [c.obra, c.indice])
    .filter(([obra, i]) => obra === id && i < total).map(([, i]) => i));
  const ultimo = Math.max(-1, ...hay);
  const huecos = [];
  for (let i = 0; i < ultimo; i++) if (!hay.has(i)) huecos.push(i);
  return { presentes: hay.size, huecos };
}

async function avisarViaje(id, estado) {

  const sinFicha = estado && (({ ficha, ...resto }) => resto)(estado);
  if (sinFicha && Number.isInteger(sinFicha.total)) Object.assign(sinFicha, await contarViaje(id, sinFicha.total).catch(() => ({})));
  for (const c of await self.clients.matchAll()) c.postMessage({ tipo: 'viaje-estado', id, estado: sinFicha });
}

async function espacioAgotado(total, guardados, ficha) {
  if (typeof comprobarEspacioViaje !== 'function') return false;
  const est = await (typeof navigator !== 'undefined' ? navigator.storage?.estimate?.() : null)?.catch?.(() => null);
  return !!est && !comprobarEspacioViaje({ total, guardados, ...(ficha ? { ficha } : {}) }, est).permitido;
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
  const estado = { id, total, guardados: desde, completa: false, continuar: true, reanudando: desde > 0,
    revisionPendiente: forzar || !!anterior?.revisionPendiente,
    faltantes: forzar || reintentarHuecos ? [] : anterior?.faltantes || [],
    almacenados: Math.max(total, anterior?.almacenados || anterior?.total || 0),

    bytesComic: anterior?.bytesComic || {}, serieComicEstimada: !!anterior?.serieComicEstimada,
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
        return contenidoDeViaje(html);
      }
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(await textoDelViaje('capitulo', indice + 1));
}

const idiomaElegido = async () => { const a = await ajustesGuardados(); return a.readTranslated && typeof a.lang === 'string' ? a.lang : null; };
const textoDe = html => typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim() ? html : null;

async function preguntarAlPC(canal, args, capitulo) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const { estado, cuerpo } = await llamarAlPC(canal, args);
      if (estado === 200 && !cuerpo?.error) return cuerpo?.valor;
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(await textoDelViaje('traduccion', capitulo));
}

async function traducirParaViaje(estado, indice) {
  const { id, idioma } = estado;
  if (!estado.revisionPendiente && await leerViaje('traducciones', [id, indice, idioma])) return;
  const nombre = indice + 1;
  if (!await preguntarAlPC('has-translation', [id, indice, idioma], nombre)) return;
  const html = textoDe(await preguntarAlPC('translate-chapter', [id, indice, idioma], nombre));
  if (html) {
    if (typeof comprobarContenidoViaje === 'function') {
      const c = comprobarContenidoViaje('traduccion', html);
      if (!c.permitido) throw Object.assign(new Error(c.motivo), { name: 'QuotaExceededError' });
    }
    await escribirViaje('traducciones', { obra: id, indice, idioma, html });
  }
}

async function fijarTraduccionLeida(args, html) {
  const id = String(args[0]), estado = await leerViaje('obras', id).catch(() => null);
  if (!estado || !textoDe(html) || !Number.isInteger(args[1])) return;
  await escribirViaje('traducciones', { obra: id, indice: args[1], idioma: args[2], html });
  if (typeof programarIdiomaDeViaje === 'function') {
    await programarIdiomaDeViaje(id, args[2]);
  } else if (!viajeEnCurso && estado.idioma !== args[2]) {
    await escribirViaje('obras', { ...estado, idioma: args[2] });
  }
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
  if (canal === 'audio-capitulo' && typeof fijadoDeAudio === 'function') return fijadoDeAudio(id, args[1], args[2]);
  return null;
}

async function descargarTramoViaje(estado) {
  const fin = Math.min(estado.total, estado.guardados + 12);
  for (let i = estado.guardados; i < fin; i++) {
    if (viajeCancelado.has(estado.id)) break;
    if (await espacioAgotado(estado.total, i)) {
      estado.error = 'No queda espacio para guardar esta obra en el móvil.';
      estado.continuar = false;
      await escribirAvanceViaje(estado);
      break;
    }
    if (estado.revisionPendiente || !await leerViaje('capitulos', [estado.id, i])) {
      const html = await traerCapituloViaje(estado.id, i);
      if (html) {
        await escribirCapituloViaje(estado, i, html);
        await (await caches.open(CACHE)).delete(claveDe('get-chapter-content', [estado.id, i]));
      } else estado.faltantes.push(i);
    }
    if (estado.idioma) await traducirParaViaje(estado, i);
    if (typeof bajarAudioParaViaje === 'function') await bajarAudioParaViaje(estado, i);
    estado.guardados = i + 1;
    await escribirAvanceViaje(estado);
    if (i % 5 === 4) await avisarViaje(estado.id, { ...estado, enCurso: true });
  }
  return cerrarTramo(estado);
}

async function cerrarTramo(estado) {
  estado.continuar = estado.guardados < estado.total;
  if (!estado.continuar && estado.faltantes.length) {
    const numeros = estado.faltantes.slice(0, 3).map(i => i + 1).join(', ');
    estado.error = await textoDelViaje(estado.faltantes.length === 1 ? 'falta' : 'faltan', numeros);
  } else if (!estado.continuar) {
    estado.completa = true;
    estado.revisionPendiente = false;
  }
  const escrito = await escribirAvanceViaje(estado);
  return escrito ? Object.assign(estado, escrito) : estado;
}

const idDeFondo = id => `viaje-${id}`;
const fondoDe = async id => (await self.registration.backgroundFetch?.get(idDeFondo(id)).catch(() => null)) || null;

const bajandoEnFondo = async id => { const r = await fondoDe(id); return r && !r.result ? r : null; };

async function traducirLoGuardado(estado) {
  if (!estado.idioma || estado.guardados < estado.total) return null;
  for (let i = 0; i < estado.total; i++) {
    try { await traducirParaViaje(estado, i); } catch (e) { estado.guardados = i; return e.message; }
  }
  return null;
}

const recogiendo = new Set(), seguirTrasRecoger = new Map();
const sigueApuntada = async id => !viajeCancelado.has(id) && !!await leerViaje('obras', id).catch(() => null);

async function guardarDelFondo(estado, porIndice) {
  let primerHueco = null;
  for (let i = estado.guardados; i < estado.total; i++) {
    if (await espacioAgotado(estado.total, i)) { estado.error = 'No queda espacio para guardar esta obra en el móvil.'; break; }
    const r = porIndice.get(i);
    const respuesta = r && await r.responseReady.catch(() => null);
    const html = respuesta?.ok ? (await respuesta.json().catch(() => null))?.valor : null;
    if (contenidoDeViaje(html)) {
      if (!await sigueApuntada(estado.id)) return false;
      try { await escribirCapituloViaje(estado, i, html); } catch (e) {
        estado.error = e.name === 'QuotaExceededError' ? e.message : 'No se pudo guardar un capítulo en el móvil. Se reanudará.';
        if (e.name !== 'QuotaExceededError') estado.reintentarAlConectar = true;
        break;
      }
      await (await caches.open(CACHE)).delete(claveDe('get-chapter-content', [estado.id, i]));
    } else if (primerHueco === null && (estado.revisionPendiente || !await leerViaje('capitulos', [estado.id, i]))) primerHueco = i;
  }
  estado.guardados = primerHueco ?? (estado.error ? estado.guardados : estado.total);
  return true;
}

async function recogerFondo(registro) {
  const id = String(registro.id).replace(/^viaje-/, '');
  recogiendo.add(id);
  try {
    const estado = await leerViaje('obras', id).catch(() => null);
    if (!estado) { viajeCancelado.delete(id); return; }
    const porIndice = new Map();
    for (const r of await registro.matchAll()) porIndice.set(Number(new URL(r.request.url).pathname.split('/').pop()), r);
    if (!await guardarDelFondo(estado, porIndice) || viajeCancelado.has(id)) {
      viajeCancelado.delete(id);
      await borrarViaje(id).catch(() => {});
      return avisarViaje(id, null);
    }
    estado.enFondo = false;
    const fallo = await traducirLoGuardado(estado);
    await cerrarTramo(estado);
    if (fallo) await escribirViaje('obras', Object.assign(estado, { completa: false, continuar: true, error: fallo, reintentarAlConectar: true }));
    return avisarViaje(id, { ...estado, enCurso: false, terminada: !!estado.completa });

  } finally { recogiendo.delete(id); await trasRecoger(id); }
}

const apuntarTrasRecoger = (id, pedido, antes = seguirTrasRecoger.get(id)) => pedido ? seguirTrasRecoger.set(id, { ...pedido,
  forzar: pedido.forzar || !!antes?.forzar, ficha: pedido.ficha || antes?.ficha || null }) : seguirTrasRecoger.has(id) || seguirTrasRecoger.set(id, null);
const trasRecoger = (id, p = seguirTrasRecoger.get(id)) => seguirTrasRecoger.delete(id) && (p ? descargarViaje(id, p.total, p.forzar, p.ficha) : seguirViaje(id));
const avisarEnFondo = async id => { const g = await leerViaje('obras', id).catch(() => null); return avisarViaje(id, g && { ...g, enCurso: true, enFondo: true }); };

const seguirViaje = id => leerViaje('obras', id).catch(() => null).then(e => pendienteDeViaje(e, true) ? descargarViaje(id, e.total) : undefined);

for (const tipo of ['backgroundfetchsuccess', 'backgroundfetchfail', 'backgroundfetchabort'])
  self.addEventListener(tipo, e => e.waitUntil(recogerFondo(e.registration)));
self.addEventListener('backgroundfetchclick', e => e.waitUntil(self.clients.openWindow?.(`${BASE}/app/`)));

async function descargarViaje(id, total, forzar = false, ficha = null, dePagina = false) {

  if (recogiendo.has(id)) { apuntarTrasRecoger(id, dePagina && { total, forzar, ficha }); return avisarEnFondo(id); }
  if (viajeEnCurso) {

    if (viajeEnCurso !== id) await prepararViaje(id, total, forzar, ficha).catch(() => {});
    const guardado = await leerViaje('obras', id).catch(() => null);
    return avisarViaje(id, guardado && { ...guardado, enCurso: viajeEnCurso === id,
      esperandoOtraObra: viajeEnCurso !== id });
  }
  viajeEnCurso = id;

  if (await bajandoEnFondo(id)) {
    viajeEnCurso = null;
    if (viajeCancelado.delete(id)) {
      await (await fondoDe(id))?.abort().catch(() => {});
      await borrarViaje(id).catch(() => {});
      return avisarViaje(id, null);
    }
    return avisarEnFondo(id);
  }
  let salida;

  let agotado = false;
  const reloj = setTimeout(() => { agotado = true; }, PRESUPUESTO_VIAJE_MS);
  try {
    if (await espacioAgotado(total, 0, ficha)) {
      throw Object.assign(new Error('No queda espacio para guardar esta obra en el móvil.'), { name: 'QuotaExceededError' });
    }
    let estado = await descargarTramoViaje(await prepararViaje(id, total, forzar, ficha));
    while (estado.continuar && !agotado && !viajeCancelado.has(id)) estado = await descargarTramoViaje(estado);
    salida = estado;
  }
  catch (e) {
    const estado = await leerViaje('obras', id).catch(() => null);
    const cuota = e.name === 'QuotaExceededError';
    const error = cuota ? (e.espacioViaje ? e.message : 'No queda espacio para guardar esta obra en el móvil.')
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
  const lista = await obrasDeViaje();
  const pendiente = lista.find(o => pendienteDeViaje(o, conectado));
  if (pendiente) return descargarViaje(pendiente.id, pendiente.total);
  if (conectado && typeof completarIdiomaDeViaje === 'function') {
    const pendIdioma = lista.find(o => o?.traduccionPendiente && o?.idioma);
    if (pendIdioma) return completarIdiomaDeViaje(pendIdioma);
  }
}

async function mensajeViaje(d) {
  if (d.tipo === 'viaje-reanudar') {
    const sesiones = enviarSesiones(d.conectado === true).catch(() => {});
    const decisiones = typeof sincronizarDecisiones === 'function' ? sincronizarDecisiones(d.conectado === true).catch(() => {}) : null;
    await reanudarViaje(d.conectado === true);
    return Promise.all([sesiones, decisiones]);
  }
  const id = d.id;
  if (typeof id !== 'string' || !/^[\w.-]{1,160}$/.test(id)) return;
  if (d.tipo === 'viaje-estado') {
    const estado = await leerViaje('obras', id);
    return avisarViaje(id, estado && { ...estado, enCurso: viajeEnCurso === id });
  }
  if (d.tipo === 'viaje-seguir') return seguirViaje(id);
  if (d.tipo === 'viaje-borrar') {
    if (viajeEnCurso === id || recogiendo.has(id)) {
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
    return descargarViaje(id, d.total, d.tipo === 'viaje-refrescar', ficha, true);
}
