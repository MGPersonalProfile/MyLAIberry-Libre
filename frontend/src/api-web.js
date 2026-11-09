import { fijarEquipo, textoDelEquipo, textoSinConexion } from './equipo.js';

export function baseDelServidor() {
  const ruta = window.location.pathname;
  const i = ruta.indexOf('/app/');
  return i >= 0 ? ruta.slice(0, i) : '';
}

export function urlDeFichero(rutaLocal) {
  return `${window.__MYLAIBERRY_BASE__ || ''}/fichero?ruta=${encodeURIComponent(rutaLocal)}`;
}

function traducirFicheros(valor) {
  if (typeof valor === 'string') {
    return valor.startsWith('local-file:///')
      ? urlDeFichero(decodeURI(valor.slice('local-file:///'.length).replace(/\?.*$/, '')))
      : valor;
  }
  if (Array.isArray(valor)) return valor.map(traducirFicheros);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, traducirFicheros(v)]));
  }
  return valor;
}

export function argumentosParaEnviar(args) {
  const lista = [...args];
  while (lista.length && lista[lista.length - 1] === undefined) lista.pop();
  return lista;
}

function sinConexion(sufijo = '') {
  const e = falloDelPC(textoSinConexion({ sufijo }));
  e.sinConexion = true;
  return e;
}

export async function llamar(base, canal, args) {
  args = argumentosParaEnviar(args);
  let r;
  try {
    r = await fetch(`${base}/api/${encodeURIComponent(canal)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
  } catch { throw sinConexion(); }
  const cuerpo = await r.json().catch(() => ({ error: textoDelEquipo('offline.respondio', { n: r.status }) }));

  if (cuerpo.sinConexion) throw sinConexion(cuerpo.codigo === 'no-hecho' ? 'offline.no_hecho' : 'offline.no_guardado');
  if (cuerpo.error) throw falloDelPC(cuerpo.error);
  return traducirFicheros(cuerpo.valor);
}

function falloDelPC(mensaje) {
  const e = new Error(mensaje);
  e.delPC = true;
  return e;
}

function conectarAvisos(base) {
  const oyentes = new Map();
  const fuente = new EventSource(`${base}/eventos`);

  const avisarConexion = (hay) => {
    window.__MYLAIBERRY_PC_EN_LINEA__ = hay;
    window.dispatchEvent(new CustomEvent('mylaiberry-conexion', { detail: hay }));
  };
  fuente.onopen = () => avisarConexion(true);
  fuente.onerror = () => avisarConexion(false);
  fuente.onmessage = (e) => {
    let aviso;
    try { aviso = JSON.parse(e.data); } catch { return; }
    for (const cb of oyentes.get(aviso.canal) || []) cb(traducirFicheros(aviso.datos));
  };
  return (evento, unico, cb) => {
    if (!oyentes.has(evento)) oyentes.set(evento, new Set());
    const lista = oyentes.get(evento);
    if (unico) lista.clear();
    lista.add(cb);
    return () => lista.delete(cb);
  };
}

export function enlaceCompartido(search) {
  const p = new URLSearchParams(search || '');
  for (const v of [p.get('compartido_url'), p.get('compartido_texto'), p.get('compartido_titulo')]) {
    const m = String(v || '').match(/https?:\/\/\S+/i);
    if (!m) continue;
    try { return new URL(m[0]).href; } catch {  }
  }
  return null;
}

function conCompartido(suscribirAviso) {
  let pendiente = enlaceCompartido(window.location.search);
  if (pendiente) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  return (cb) => {
    const soltar = suscribirAviso(cb);
    if (pendiente) { const url = pendiente; pendiente = null; setTimeout(() => cb({ url }), 0); }
    return soltar;
  };
}

export async function descargarEpub(base, id, opciones = {}) {
  const t = opciones?.traducido === undefined ? '' : `?traducido=${opciones.traducido ? 1 : 0}`;
  let r;
  try { r = await fetch(`${base}/epub/${encodeURIComponent(id)}${t}`); } catch { throw sinConexion(); }
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => ({}));
    return { status: 'error', message: cuerpo.error || textoDelEquipo('offline.respondio', { n: r.status }) };
  }
  const nombre = nombreDeDescarga(r.headers.get('Content-Disposition')) || 'obra.epub';
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(await r.blob());
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 60_000);
  return { status: 'ok', capitulos: Number(r.headers.get('X-Capitulos')) || 0, total: Number(r.headers.get('X-Total')) || 0 };
}

export function descargarAudioObra(base, id, opciones = {}) {
  const idioma = /^[a-z]{2}$/.test(opciones?.idioma || '') ? opciones.idioma : 'es';
  const enlace = document.createElement('a');
  enlace.href = `${base}/audio-obra/${encodeURIComponent(id)}?idioma=${idioma}`;
  enlace.download = '';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  return Promise.resolve({ status: 'ok', comoDescarga: true });
}

const TROZO_SUBIDA = 2 * 1024 * 1024;

export async function subirLibro(base, fichero, alAvanzar = () => {}) {
  const id = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
  const consulta = (extra) => `${base}/subir?id=${id}&nombre=${encodeURIComponent(fichero.name)}&total=${fichero.size}${extra}`;
  let desde = 0, fallos = 0;
  while (desde < fichero.size) {
    let r;
    try {
      r = await fetch(consulta(`&desde=${desde}`), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' },
        body: fichero.slice(desde, desde + TROZO_SUBIDA) });
    } catch { r = null; }
    const cuerpo = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && Number.isSafeInteger(cuerpo.recibidos)) { desde = cuerpo.recibidos; fallos = 0; alAvanzar(Math.round(desde / fichero.size * 100)); continue; }

    if (r && r.status !== 409) return { status: 'error', message: cuerpo.error || textoDelEquipo('offline.respondio', { n: r.status }) };
    if (++fallos >= 3) return { status: 'error', message: r ? (cuerpo.error || 'La subida no avanza.') : textoSinConexion() };
    if (Number.isSafeInteger(cuerpo.recibidos)) desde = cuerpo.recibidos;
  }
  let fin;
  try { fin = await fetch(`${base}/subir?id=${id}&fin=1`, { method: 'POST' }); } catch { return { status: 'error', message: textoSinConexion() }; }
  const cuerpo = await fin.json().catch(() => ({}));
  if (!fin.ok || cuerpo.error) return { status: 'error', message: cuerpo.error || textoDelEquipo('offline.respondio', { n: fin.status }) };
  return cuerpo.valor || { status: 'error', message: textoDelEquipo('offline.sin_respuesta') };
}

export function nombreDeDescarga(cabecera) {
  const c = String(cabecera || '');
  const largo = c.match(/filename\*=UTF-8''([^;]+)/i);
  if (largo) { try { return decodeURIComponent(largo[1]); } catch {  } }
  return (c.match(/filename="([^"]+)"/i) || [])[1] || null;
}

export async function instalarApiWeb() {
  if (window.api) return false;
  const base = baseDelServidor();
  window.__MYLAIBERRY_BASE__ = base;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});

    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo === 'mylaiberry-fresco') window.dispatchEvent(new CustomEvent('mylaiberry-fresco', { detail: e.data.canal }));
    });
  }
  const { metodos, avisos, equipo } = await (await fetch(`${base}/puente.json`)).json();
  fijarEquipo(equipo);
  const suscribir = conectarAvisos(base);
  const api = {};
  for (const [nombre, canal] of Object.entries(metodos)) api[nombre] = (...args) => llamar(base, canal, args);
  for (const [nombre, { evento, unico }] of Object.entries(avisos)) api[nombre] = (cb) => suscribir(evento, unico, cb);
  if (api.alLlegarEnlace) api.alLlegarEnlace = conCompartido(api.alLlegarEnlace);

  api.abrirEnNavegador = (url) => {
    if (/^https?:\/\//i.test(String(url || ''))) window.open(url, '_blank', 'noopener,noreferrer');
    return { status: 'ok' };
  };
  api.exportarEpub = (id, opciones) => descargarEpub(base, id, opciones);
  api.guardarAudioObra = (id, opciones) => descargarAudioObra(base, id, opciones);
  api.subirLibro = (fichero, alAvanzar) => subirLibro(base, fichero, alAvanzar);
  api.fotogramaRetoRemoto = (id, token, ultimo) => pedirFotogramaReto(base, id, token, ultimo);
  window.api = api;
  return true;
}

export async function pedirFotogramaReto(base, id, token, ultimo = null) {
  let r;
  try {
    r = await fetch(`${base}/reto-remoto/${encodeURIComponent(id)}/fotograma${ultimo ? `?ultimo=${ultimo}` : ''}`,
      { headers: { 'X-Reto-Token': token }, cache: 'no-store', credentials: 'same-origin' });
  } catch { throw sinConexion(); }
  const idFotograma = Number(r.headers.get('X-Fotograma-Id'));
  if (r.status === 204) return { id: idFotograma, igual: true, cadenciaMs: Number(r.headers.get('X-Cadencia-Ms')) || 1000 };
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => ({}));
    throw Object.assign(falloDelPC(cuerpo.error || textoDelEquipo('offline.respondio', { n: r.status })), { codigo: cuerpo.codigo, estado: r.status });
  }
  const [w, h] = String(r.headers.get('X-Viewport') || '').split('x').map(Number);
  return { id: idFotograma, blob: await r.blob(), viewport: { w, h }, cadenciaMs: Number(r.headers.get('X-Cadencia-Ms')) || 1000 };
}
