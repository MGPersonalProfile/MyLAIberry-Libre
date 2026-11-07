const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const PREFIJO = `mylaiberry-${self.registration.scope}`;
const CACHE = PREFIJO + 'contenido-2', APP = PREFIJO + 'app-2', ESTADO = PREFIJO + 'estado-2';
const PLAZO_MS = 4000, PLAZO_INSTALAR = 60000, PLAZO_PAGINA = 1500, PLAZO_LECTURA = 8000, PLAZO_CON_COPIA = 2500, TECHO_LECTURA = 90000, TECHO_ACCION = 180000, TECHO_LARGO = 600000;
const TECHO = 800;
const ESENCIAL = ['/app/', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png', '/puente.json'].map(r => BASE + r);
const esNuestra = u => u.origin === self.location.origin && u.pathname.startsWith(BASE + '/');

const LECTURAS = new Set(['asistente-ver', 'repeated-works', 'check-repeated-chapters', 'search-in-work', 'detect-site', 'estadisticas-lectura', 'recordar-lectura']);

const EN_VIVO = new Set(['asistente-retos-pendientes', 'queue-status', 'lan-estado', 'estado-voces', 'avisos-disponibles', 'avisos-via', 'exportar-lectura']);
const DEL_AUDIO = new Set(['audio-capitulo', 'audio-obra']);
const pideAlgo = args => Array.isArray(args) && args.some(a => a && typeof a === 'object' && a.pedir === true);
const DE_LEER = { has: (c, args) => /^(get|has|listar)-/.test(c) || ['translate-chapter', 'translate-synopsis'].includes(c)
  || LECTURAS.has(c) || EN_VIVO.has(c) || (DEL_AUDIO.has(c) && !pideAlgo(args)) };
const ESENCIALES = new Set(['get-library', 'get-settings', 'get-chapter-content', 'translate-chapter']);
const fallaSinCopia = c => ESENCIALES.has(c) || LECTURAS.has(c) || EN_VIVO.has(c) || DEL_AUDIO.has(c);
const sinCopia = c => EN_VIVO.has(c) || DEL_AUDIO.has(c);
const DE_PROGRESO = new Set(['update-progress', 'save-scroll-position']);

const PROYECTABLES = new Set(['get-library', 'get-work', 'get-fanfic', 'get-scroll-position']);

const PC_CAIDO_MS = 15000;
let pcCaidoHasta = 0;
const pcNoContesta = () => Date.now() < pcCaidoHasta;
const pcContesta = (si) => { pcCaidoHasta = si ? 0 : Date.now() + PC_CAIDO_MS; };

function vigilar(peticion) {
  let hecha = false;
  const t = setTimeout(() => { if (!hecha) pcContesta(false); }, PLAZO_MS);
  const fin = (si) => { hecha = true; clearTimeout(t); pcContesta(si); };
  peticion.then(() => fin(true), () => fin(false));
  return peticion;
}

const PAGINAS = ['/app/', '/puente.json'];

const INSTALADO = () => `${BASE}/__instalado__`;
const RECIBOS = new Set(['log-reading', 'asistente-leido']);
const LARGAS = new Set(['asistente-reto-reanudar', 'asistente-chat', 'asistente-accion', 'translate-chapter', 'translate-synopsis', 'redo-translations', 'redo-translations-many', 'repair-work', 'merge-works',
  'scrape-story', 'refresh-chapters', 'resume-download', 'buscar-en-otros-sitios', 'import-bookmarks', 'adopt-work', 'get-recap']);
const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const claveDe = (canal, args) => `${self.location.origin}${BASE}/__api__/${canal}?a=${encodeURIComponent(JSON.stringify(args))}`;
const progresoClave = obra => `${BASE}/__progreso__/${encodeURIComponent(obra)}`;
const revisionClave = obra => `${BASE}/__revision__/${encodeURIComponent(obra)}`;
async function revisionDe(obra) {
  const r = await (await caches.open(ESTADO)).match(revisionClave(obra)); return r ? Number(await r.json()) || 0 : 0;
}
async function recordarRevision(obra, revision) {
  if (Number.isInteger(revision) && revision >= 0) await (await caches.open(ESTADO)).put(revisionClave(obra), json(revision));
}
async function dispositivo() {
  const cache = await caches.open(ESTADO), clave = `${BASE}/__dispositivo__`;
  const r = await cache.match(clave); if (r) return r.json();
  const id = crypto.randomUUID(); await cache.put(clave, json(id)); return id;
}
const cacheDe = url => {
  const ruta = new URL(url, self.location.origin).pathname;
  return ruta.startsWith(BASE + '/app/') || ESENCIAL.includes(ruta) ? APP : CACHE;
};

async function instalar() {
  const cache = await caches.open(APP);

  const lista = await conPlazo(fetch(`${BASE}/app/precarga.json`), PLAZO_INSTALAR);
  if (!lista.ok) throw new Error('No se pudo preparar la app sin conexión');
  const urls = [...ESENCIAL, ...(await lista.json()).map(r => `${BASE}/app/${r}`)]
    .map(r => new URL(r, self.location.origin).href);
  await (await caches.open(ESTADO)).put(INSTALADO(), json(urls));
  for (const url of new Set(urls)) {
    const r = await conPlazo(fetch(url), PLAZO_INSTALAR);
    if (!r.ok) throw new Error(`No se pudo preparar la app sin conexión (${r.status} en ${url})`);
    await cache.put(url, r);
  }

  for (const canal of ['get-settings', 'get-library']) {
    try {
      const { estado, cuerpo } = await llamarAlPC(canal, [], PLAZO_INSTALAR);
      if (estado !== 200 || cuerpo.error) continue;
      if (canal === 'get-settings') await recordarAjustes(cuerpo.valor);
      await guardarLectura(canal, [], cuerpo, claveDe(canal, []));
    } catch {  }
  }
  await self.skipWaiting();
}
async function activar() {

  if ((await caches.keys()).includes('mylaiberry-1')) {
    const vieja = await caches.open('mylaiberry-1'), estado = await caches.open(ESTADO);
    for (const clave of await vieja.keys()) {
      if (new URL(clave.url).pathname.startsWith(BASE + '/__progreso__/') && !await estado.match(clave))
        await estado.put(clave, await vieja.match(clave));
    }
  }

  const lista = await (await caches.open(ESTADO)).match(INSTALADO());
  if (lista) {
    const instalado = new Set(await lista.json()), app = await caches.open(APP);
    for (const clave of await app.keys()) {
      if (new URL(clave.url).pathname.startsWith(BASE + '/app/') && !instalado.has(clave.url)) await app.delete(clave);
    }
  }
  await self.clients.claim();
}
self.addEventListener('install', e => e.waitUntil(instalar()));
self.addEventListener('activate', e => e.waitUntil(activar()));

function conPlazo(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('plazo')), ms);
    promesa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); });
  });
}
async function guardar(peticion, respuesta, nombre = CACHE) {
  if (!respuesta?.ok) return;
  const cache = await caches.open(nombre);
  await cache.delete(peticion);
  await cache.put(peticion, respuesta);
  if (nombre !== CACHE) return;
  const claves = await cache.keys();
  for (const clave of claves.slice(0, Math.max(0, claves.length - TECHO))) await cache.delete(clave);
}

async function primeroLaRed(peticion, trabajos) {
  const url = new URL(peticion.url);
  const guardada = cacheDe(peticion.url) === APP && await (await caches.open(APP)).match(peticion);
  if (guardada && (!PAGINAS.map(p => BASE + p).includes(url.pathname) || pcNoContesta())) {
    trabajos.push(conPlazo(vigilar(fetch(peticion)), PLAZO_LECTURA).then(r => r.ok && guardar(peticion, r, APP)).catch(() => {}));
    return guardada;
  }
  try {
    const r = await conPlazo(vigilar(fetch(peticion)), guardada ? PLAZO_PAGINA : PLAZO_MS);
    trabajos.push(guardar(peticion, r.clone(), cacheDe(peticion.url)));
    return r;
  } catch {
    return await (await caches.open(cacheDe(peticion.url))).match(peticion)
      || json({ error: 'Sin conexión con tu PC: esto no estaba guardado en el móvil.' }, 503);
  }
}
async function llamarAlPC(canal, args, plazo = PLAZO_LECTURA) {
  const r = await conPlazo(fetch(`${BASE}/api/${encodeURIComponent(canal)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args)
  }), plazo);
  return { estado: r.status, cuerpo: await r.json() };
}

let sondeo = null;
function sondearPC() {
  sondeo ||= conPlazo(fetch(`${BASE}/puente.json`, { cache: 'no-store' }), PLAZO_MS).then(() => true, () => false)
    .then(vivo => { pcContesta(vivo); setTimeout(() => { sondeo = null; }, vivo ? 0 : PC_CAIDO_MS); return vivo; });
  return sondeo;
}
const mientrasElPCEste = red => Promise.race([red, sondearPC().then(vivo => vivo ? red : Promise.reject(new Error('sin PC')))]);

async function llamada(peticion, canal, trabajos) {
  let args = [];
  try { args = await peticion.clone().json(); } catch {  }
  const deLeer = DE_LEER.has(canal, args);
  if (DE_PROGRESO.has(canal)) return escribirProgreso(peticion, canal, args);
  if (RECIBOS.has(canal)) {
    await enSerie(async () => (await caches.open(ESTADO)).put(
      `${BASE}/__recibo__/${Date.now()}-${++secuencia}`, json({ canal, args })));
    trabajos.push(mandarProgreso());
    return json({ valor: null });
  }
  trabajos.push(mandarProgreso().catch(() => {}));
  const clave = await claveContextual(canal, args);
  const techo = LARGAS.has(canal) ? TECHO_LARGO : (deLeer ? TECHO_LECTURA : TECHO_ACCION);
  const servida = { copia: false };
  const red = conPlazo(vigilar(fetch(peticion)), techo).then(async r => {
    const cuerpo = await r.clone().json().catch(() => null);
    if (r.ok && cuerpo && !cuerpo.error) {
      trabajos.push(trasLlamar(canal, args, cuerpo, clave));
      if (servida.copia) trabajos.push(avisarDeLoFresco(canal));
    }
    return respuestaConPendientes(canal, args, r);
  });
  trabajos.push(red.catch(() => {}));

  const enCache = deLeer && await (await caches.open(CACHE)).match(clave);
  const fijado = (!enCache || canal === 'has-translation') && await fijadoDe(canal, args);
  const conCopia = deLeer && (!!enCache || !!fijado);
  if (conCopia && pcNoContesta()) { const g = await copia(canal, args, clave); if (g) { servida.copia = true; return g; } }
  try {
    const actual = await (deLeer && !conCopia && pcNoContesta() ? mientrasElPCEste(red)
      : conPlazo(red, deLeer ? (conCopia ? PLAZO_CON_COPIA : PLAZO_LECTURA) : techo));
    if (!actual.ok && conCopia) {
      const guardada = await copia(canal, args, clave);
      if (guardada) { servida.copia = true; return guardada; }
    }
    return actual;
  }
  catch (e) {
    const guardada = deLeer && await copia(canal, args, clave);
    if (guardada) { servida.copia = true; return guardada; }
    if (e.message === 'plazo' && deLeer) {
      try { return await mientrasElPCEste(red); } catch {  }
    }
    if (deLeer && !fallaSinCopia(canal)) return json({ valor: null });
    return json({ error: deLeer
      ? 'Sin conexión con tu PC: esto no estaba guardado en el móvil.'
      : 'Sin conexión con tu PC: no se ha hecho. Prueba cuando vuelva.' }, 503);
  }
}

async function avisarDeLoFresco(canal) {
  for (const c of await self.clients.matchAll()) c.postMessage({ tipo: 'mylaiberry-fresco', canal });
}
async function trasLlamar(canal, args, cuerpo, clave) {
  if (DE_LEER.has(canal, args) && !sinCopia(canal)) await guardarLectura(canal, args, cuerpo, clave);
  if (canal === 'get-settings') await recordarAjustes(cuerpo.valor);
  if (canal === 'update-settings') await recordarAjustes(args[0]);
  if (canal === 'has-translation' && typeof args[2] === 'string')
    await (await caches.open(ESTADO)).put(`${BASE}/__idioma__`, json(args[2]));
  if (canal === 'translate-chapter' && typeof args[2] === 'string') await fijarTraduccionLeida(args, cuerpo.valor);
  if (canal === 'get-chapter-content') await adelantarObra(args[0], Number(args[1]) + 1, 3);
  if (canal === 'get-library' && Array.isArray(cuerpo.valor)) await adelantarBiblioteca(cuerpo.valor);
  const obras = Array.isArray(cuerpo.valor) ? cuerpo.valor : [cuerpo.valor];
  for (const obra of obras) if (obra?.id && Number.isInteger(obra.lecturaRevision))
    await recordarRevision(String(obra.id), obra.lecturaRevision);
}
async function recordarAjustes(ajustes) {
  if (!ajustes || typeof ajustes !== 'object') return;
  const cache = await caches.open(ESTADO), clave = `${BASE}/__ajustes__`;
  const previo = await cache.match(clave).then(r => r ? r.json() : {});
  await cache.put(clave, json({ ...previo, ...ajustes }));
  if (ajustes.lang) await cache.put(`${BASE}/__idioma__`, json(ajustes.lang));
}
async function ajustesGuardados() {
  const r = await (await caches.open(ESTADO)).match(`${BASE}/__ajustes__`);
  return r ? r.json() : {};
}
async function claveContextual(canal, args) {
  if (!['get-chapter-titles', 'get-recap'].includes(canal)) return claveDe(canal, args);
  const a = await ajustesGuardados();
  return claveDe(canal, [...args, { idioma: a.lang || 'es', traducido: !!a.readTranslated }]);
}
async function guardarLectura(canal, args, cuerpo, clave) {
  const cache = await caches.open(CACHE);
  if (['get-chapter-content', 'translate-chapter'].includes(canal)
    && (typeof cuerpo.valor !== 'string' || !cuerpo.valor.replace(/<[^>]*>/g, '').trim())) {
    await cache.delete(clave); return;
  }
  await guardar(clave, json(cuerpo));
  if (canal === 'has-translation' && !cuerpo.valor) await cache.delete(claveDe('translate-chapter', args));
}
async function traerYGuardar(canal, args) {
  try {
    const { estado, cuerpo } = await llamarAlPC(canal, args);
    if (estado === 200 && !cuerpo.error) await guardarLectura(canal, args, cuerpo, claveDe(canal, args));
    return estado === 200 && !cuerpo.error;
  } catch { return false; }
}
async function adelantarObra(id, desde, cuantos) {
  if (!id || !Number.isInteger(desde)) return;
  const idiomaGuardado = await (await caches.open(ESTADO)).match(`${BASE}/__idioma__`);
  const idioma = idiomaGuardado ? await idiomaGuardado.json() : null;
  for (let i = desde; i < desde + cuantos; i++) {
    if (!await traerYGuardar('get-chapter-content', [id, i])) return;
    if (!idioma) continue;
    if (!await traerYGuardar('has-translation', [id, i, idioma])) return;
    const hay = await (await caches.open(CACHE)).match(claveDe('has-translation', [id, i, idioma]));
    if (hay && (await hay.json()).valor) await traerYGuardar('translate-chapter', [id, i, idioma]);
  }
}
let ultimoAdelanto = 0;
async function adelantarBiblioteca(obras) {
  if (Date.now() - ultimoAdelanto < 5 * 60_000) return;
  ultimoAdelanto = Date.now();
  const empezadas = obras.filter(o => o?.id && (o.lastReadAt || (o.currentChapter || 0) > 0))
    .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0)).slice(0, 5);
  for (const o of empezadas) await adelantarObra(o.id, o.currentChapter || 0, 3);
}

let cerrojo = Promise.resolve(), mandando = null, secuencia = 0;
function enSerie(tarea) {
  const p = cerrojo.then(tarea);
  cerrojo = p.catch(() => {});
  return p;
}
async function apuntarProgreso(canal, args) {
  return enSerie(async () => {
    const [obra, capitulo, posicion] = args;
    if (typeof obra !== 'string' || !Number.isInteger(capitulo) || capitulo < 0) throw new Error('Progreso no válido');
    const cache = await caches.open(ESTADO), clave = progresoClave(obra);
    const previo = await cache.match(clave).then(r => r && r.json());
    const p = { obra, capitulo, en: Date.now(), revision: ++secuencia,
      deviceId: await dispositivo(), mutationId: crypto.randomUUID(), baseRevision: await revisionDe(obra), posicion,
      ancla: canal === 'save-scroll-position' ? posicion?.ancla || null
        : (previo?.capitulo === capitulo ? previo.ancla : null) };
    await cache.put(clave, json(p));
    if (canal === 'save-scroll-position') await cache.put(
      claveDe('get-scroll-position', [obra, capitulo]), json({ valor: posicion }));
  });
}
async function escribirProgreso(peticion, canal, args) {

  await mandarProgreso();
  try {
    const respuesta = await conPlazo(fetch(peticion), PLAZO_LECTURA), cuerpo = await respuesta.clone().json().catch(() => null);
    if (respuesta.ok && Number.isInteger(cuerpo?.valor?.revision)) await recordarRevision(String(args[0]), cuerpo.valor.revision);
    return respuesta;
  }
  catch { await apuntarProgreso(canal, args); return json({ valor: null }); }
}
function mandarProgreso() {
  if (!mandando) mandando = enviarPendientes().finally(() => { mandando = null; });
  return mandando;
}
async function enviarPendientes() {
  const cache = await caches.open(ESTADO);
  const contestadas = new Set();
  try {
    for (const clave of await cache.keys()) {
      const ruta = new URL(clave.url).pathname, progreso = ruta.startsWith(BASE + '/__progreso__/');
      if (!progreso && !ruta.startsWith(BASE + '/__recibo__/')) continue;
      const copia = await enSerie(() => cache.match(clave));
      if (!copia) continue;
      const cuerpo = await copia.text(), datos = JSON.parse(cuerpo);
      let resuelto;
      if (progreso) {
        const r = await conPlazo(vigilar(fetch(`${BASE}/progreso`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: cuerpo })), PLAZO_LECTURA);
        contestadas.add(datos.obra);
        resuelto = r.status === 204 || r.status === 409;
        const revision = Number(r.headers.get('X-Lectura-Revision'));
        if (resuelto && Number.isInteger(revision)) await recordarRevision(datos.obra, revision);
        if (r.status === 204) await actualizarCopias({ ...datos, revisionServidor: revision }); else if (r.status === 409) await cache.delete(claveDe('get-scroll-position', [datos.obra, datos.capitulo]));
      } else {
        const r = await llamarAlPC(datos.canal, datos.args);
        resuelto = r.estado === 200 && !r.cuerpo.error && r.cuerpo.valor?.status !== 'error';
      }
      if (resuelto) await enSerie(async () => {
        const actual = await cache.match(clave);
        if (actual && await actual.text() === cuerpo) await cache.delete(clave);
      });
    }
  } catch {  }
  return contestadas;
}
function proyectar(canal, args, cuerpo, p, posicion) {
  if (canal === 'get-scroll-position' && args[0] === p.obra && args[1] === p.capitulo && (!Number.isInteger(cuerpo.valor?.revision) || cuerpo.valor.revision <= p.baseRevision))
    cuerpo.valor = posicion ?? { px: 0, ancla: p.ancla };
  const obras = Array.isArray(cuerpo.valor) ? cuerpo.valor : [cuerpo.valor];
  for (const o of obras) if (o && typeof o === 'object' && String(o.id) === p.obra
    && (!Number.isInteger(o.lecturaRevision) || o.lecturaRevision <= p.baseRevision)) {
    o.currentChapter = p.capitulo; o.lastReadAt = p.en; o.progresoEn = p.en;
    if (Number.isInteger(p.revisionServidor)) o.lecturaRevision = p.revisionServidor;
    o.scrollPositions = { ...o.scrollPositions, [p.capitulo]: posicion ?? { px: 0, ancla: p.ancla } };
  }
  return cuerpo;
}

async function conPendientes(canal, args, cuerpo) {
  const cache = await caches.open(ESTADO);
  let posicionPedida = false;
  for (const k of await cache.keys()) if (new URL(k.url).pathname.startsWith(BASE + '/__progreso__/')) {
    const pendiente = await cache.match(k);
    if (!pendiente) continue;
    const p = await pendiente.json();
    const local = await cache.match(claveDe('get-scroll-position', [p.obra, p.capitulo]));
    proyectar(canal, args, cuerpo, p, local ? (await local.json()).valor : undefined);
    if (canal === 'get-scroll-position' && args[0] === p.obra && args[1] === p.capitulo) posicionPedida = true;
  }
  return posicionPedida;
}
async function copia(canal, args, clave) {
  const cache = await caches.open(ESTADO), r = await (await caches.open(CACHE)).match(clave);
  const fijado = (!r || canal === 'has-translation') && await fijadoDe(canal, args);
  const posicion = canal === 'get-scroll-position' && await cache.match(claveDe(canal, args));
  const cuerpo = fijado ? { valor: fijado.valor } : r ? await r.json() : { valor: null };
  let hay = !!fijado || !!r || !!posicion;
  if (posicion) cuerpo.valor = (await posicion.clone().json()).valor;
  if (await conLoGuardado(canal, args, cuerpo)) hay = true;
  if (await conPendientes(canal, args, cuerpo)) hay = true;
  return hay ? json(cuerpo) : null;
}

async function respuestaConPendientes(canal, args, r) {
  if (!PROYECTABLES.has(canal) || !r.ok) return r;
  const cuerpo = await r.clone().json().catch(() => null);
  if (!cuerpo || cuerpo.error) return r;
  await conPendientes(canal, args, cuerpo);
  return json(cuerpo);
}
async function actualizarCopias(p) {
  const cache = await caches.open(CACHE);
  const local = await (await caches.open(ESTADO)).match(claveDe('get-scroll-position', [p.obra, p.capitulo]));
  const posicion = local ? (await local.json()).valor : undefined;
  for (const k of await cache.keys()) {
    const u = new URL(k.url), canal = u.pathname.split('/').pop();
    if (!PROYECTABLES.has(canal)) continue;
    const cuerpo = await (await cache.match(k)).json();
    await cache.put(k, json(proyectar(canal, JSON.parse(u.searchParams.get('a')), cuerpo, p, posicion)));
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!esNuestra(url)) return;
  const api = url.pathname.startsWith(BASE + '/api/') && decodeURIComponent(url.pathname.slice(BASE.length + 5));
  if (!(e.request.method === 'POST' && api) && (e.request.method !== 'GET' || /\/eventos$/.test(url.pathname))) return;
  const trabajos = [], respuesta = api === CANAL_SESIONES ? atenderSesion(e.request, trabajos) : api ? llamada(e.request, api, trabajos) : primeroLaRed(e.request, trabajos);
  e.respondWith(respuesta);

  e.waitUntil((async () => {
    await respuesta.catch(() => {});
    for (let i = 0; i < trabajos.length; i++) await trabajos[i].catch(() => {});
  })());
});
async function adelantar(urls) {
  for (const u of urls) {
    const url = new URL(u, self.location.origin);
    if (!esNuestra(url)) continue;
    try { await guardar(url.href, await conPlazo(fetch(url.href), PLAZO_LECTURA), cacheDe(url.href)); }
    catch { return; }
  }
}
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'adelantar' && Array.isArray(d.urls)) e.waitUntil(adelantar(d.urls.slice(0, 40)));
  if (typeof d.tipo === 'string' && d.tipo.startsWith('viaje-')) e.waitUntil(mensajeViaje(d));
});
