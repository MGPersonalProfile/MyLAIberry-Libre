const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dns = require('node:dns');
const { conRitmo, sitioDe } = require('./scrapers/navegar');
const net = require('node:net');
const { TECHO_DEL_FICHERO } = require('./epub');

const MAX_REDIRECCIONES = 5;
const SILENCIO_MS = 60000;

function direccionWeb(valor) {
  const u = new URL(String(valor || '').trim());
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('Pega una dirección web sin credenciales.');
  return u.href;
}

function tipoLibro(buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (buffer.subarray(0, 2).toString() === 'PK') return 'epub';
  if (/^\uFEFF?\s*(?:<!doctype\s+html\b|<html\b)/i.test(buffer.toString('utf8', 0, 512))) return 'html';
  throw new Error('Ese fichero no es un EPUB, un PDF ni un HTML de AO3. MOBI y AZW3 no se admiten.');
}

function parsearIpv4MapeadaHex(v) {
  const m = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!m) return null;
  const w = parseInt(m[1], 16);
  const z = parseInt(m[2], 16);
  return `${(w >> 8) & 0xff}.${w & 0xff}.${(z >> 8) & 0xff}.${z & 0xff}`;
}

function ipPrivada(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapeada = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return ipPrivada(mapeada[1]);
    const hexIpv4 = parsearIpv4MapeadaHex(v);
    if (hexIpv4) return ipPrivada(hexIpv4);
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const resolverDns = async host => (await dns.promises.lookup(host, { all: true })).map(r => r.address);

async function comprobarDestino(url, resolver) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [host] : await resolver(host).catch(() => { throw new Error('No se encuentra ese servidor. Revisa el enlace.'); });
  if (!ips.length || ips.some(ipPrivada)) throw new Error('Ese enlace apunta a tu red local o a este equipo; sólo se importan libros de webs públicas.');
}

async function pedirConSaltos(direccion, pedir, resolver, signal) {
  let actual = direccion;
  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    await comprobarDestino(actual, resolver);
    const r = await pedir(actual, { redirect: 'manual', signal });
    const destino = r.status >= 300 && r.status < 400 && r.headers.get('location');
    if (!destino) return r;
    await r.body?.cancel();
    actual = direccionWeb(new URL(destino, actual).href);
  }
  throw new Error('El enlace redirige demasiadas veces.');
}

async function volcarDescarga(respuesta, fichero, ctrl) {
  if (!respuesta.ok) throw new Error(`La descarga respondió ${respuesta.status}. Abre el enlace en el importador web.`);
  if (Number(respuesta.headers.get('content-length')) > TECHO_DEL_FICHERO) {
    await respuesta.body?.cancel(); throw new Error('El libro supera 300 MB.');
  }
  const salida = await fs.promises.open(fichero, 'w');
  let cabeza = Buffer.alloc(0); let total = 0; let silencio = null;
  const vigilar = () => { clearTimeout(silencio); silencio = setTimeout(() => ctrl?.abort(), SILENCIO_MS); };
  try {
    vigilar();
    for await (const parte of respuesta.body) {
      vigilar();
      total += parte.length;
      if (total > TECHO_DEL_FICHERO) throw new Error('El libro supera 300 MB.');
      if (cabeza.length < 512) cabeza = Buffer.concat([cabeza, Buffer.from(parte).subarray(0, 512 - cabeza.length)]);
      await salida.write(parte);
    }
  } catch (e) {
    throw new Error(ctrl?.signal.aborted ? 'La descarga se quedó parada más de un minuto.' : `No se pudo completar la descarga: ${e.message}`);
  } finally { clearTimeout(silencio); await salida.close(); }
  const tipo = tipoLibro(cabeza);
  if (tipo === 'html') {
    try { require('./html-ao3-importar').obraDeHtmlAo3(await fs.promises.readFile(fichero)); }
    catch (e) {
      if (e.message !== require('./html-ao3-importar').ERROR_HTML) throw e;
      throw new Error(`${e.message} Abre el enlace en el importador web para iniciar sesión o elegir el archivo.`);
    }
  }
  return tipo;
}

async function leerDescarga(respuesta) {
  const carpeta = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mylaiberry-enlace-'));
  try { return { tipo: await volcarDescarga(respuesta, path.join(carpeta, 'libro'), null) }; }
  finally { await fs.promises.rm(carpeta, { recursive: true, force: true }); }
}

async function importarEnlace(url, progreso, { pedir, importar, resolver } = {}) {
  const direccion = direccionWeb(url);
  const fetchLibro = pedir || ((u, o) => fetch(u, o));
  const guardar = importar || require('./ipc/descargas').importarLibro;
  progreso?.({ step: 'fetching', message: 'Descargando el libro…' });
  const ctrl = new AbortController();
  const carpeta = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mylaiberry-enlace-'));
  try {
    const crudo = path.join(carpeta, 'descarga');
    const descargar = async () => {
      const respuesta = await pedirConSaltos(direccion, fetchLibro, resolver || resolverDns, ctrl.signal);
      return volcarDescarga(respuesta, crudo, ctrl);
    };
    const tipo = sitioDe(direccion) === 'archiveofourown.org'
      ? await conRitmo(direccion, descargar) : await descargar();
    const fichero = path.join(carpeta, `libro.${tipo}`);
    await fs.promises.rename(crudo, fichero);
    return await guardar(fichero, progreso || (() => {}), { urlOrigen: direccion });
  } finally { await fs.promises.rm(carpeta, { recursive: true, force: true }); }
}

const esEnlaceLibro = valor => {
  try {
    const url = new URL(valor);
    if (/\.(epub|pdf)$/i.test(url.pathname)) return true;
    return ['archiveofourown.org', 'www.archiveofourown.org', 'download.archiveofourown.org'].includes(url.hostname.toLowerCase())
      && /^https?:$/.test(url.protocol) && /^\/downloads\/\d+\/[^/]+\.html?$/i.test(url.pathname);
  } catch { return false; }
};

module.exports = { direccionWeb, tipoLibro, ipPrivada, comprobarDestino, leerDescarga, importarEnlace, esEnlaceLibro };
