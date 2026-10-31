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

async function llamar(base, canal, args) {
  args = argumentosParaEnviar(args);
  let r;
  try {
    r = await fetch(`${base}/api/${encodeURIComponent(canal)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
  } catch { throw falloDelPC('Sin conexión con tu PC.'); }
  const cuerpo = await r.json().catch(() => ({ error: `El PC contestó ${r.status}.` }));
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

export async function instalarApiWeb() {
  if (window.api) return false;
  const base = baseDelServidor();
  window.__MYLAIBERRY_BASE__ = base;
  const { metodos, avisos } = await (await fetch(`${base}/puente.json`)).json();
  const suscribir = conectarAvisos(base);
  const api = {};
  for (const [nombre, canal] of Object.entries(metodos)) api[nombre] = (...args) => llamar(base, canal, args);
  for (const [nombre, { evento, unico }] of Object.entries(avisos)) api[nombre] = (cb) => suscribir(evento, unico, cb);
  if (api.alLlegarEnlace) api.alLlegarEnlace = conCompartido(api.alLlegarEnlace);

  api.abrirEnNavegador = (url) => {
    if (/^https?:\/\//i.test(String(url || ''))) window.open(url, '_blank', 'noopener,noreferrer');
    return { status: 'ok' };
  };
  window.api = api;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});

    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo === 'mylaiberry-fresco') window.dispatchEvent(new CustomEvent('mylaiberry-fresco', { detail: e.data.canal }));
    });
  }
  return true;
}
