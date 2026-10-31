/**
 * Actualizaciones de la edición pública. GitHub anuncia la versión y
 * electron-builder deja en latest.yml la huella de los bytes del instalador.
 * El IPC de Ajustes sigue recibiendo las mismas respuestas que antes.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MAX_INSTALADOR = 2 * 1024 * 1024 * 1024;
const MAX_FICHA = 1024 * 1024;
const PLAZO_CONSULTA = 15000;
const PLAZO_DESCARGA = 10 * 60 * 1000;
const USER_AGENT = 'MyLAIberry-actualizador';

/** 2026.9.23 < 2026.9.23-2 < 2026.9.24. Y 1.0.0, lo de antes, más viejo que todo. */
function partes(v) {
  const [base, extra] = String(v || '0').split('-');
  return [...base.split('.').map(n => Number(n) || 0), Number(extra) || 1];
}
function esMasNueva(a, b) {
  const x = partes(a);
  const y = partes(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

function repositorioPorDefecto() {
  try { return require('../package.json').repositorio || null; } catch { return null; }
}

function urlPermitida(direccion) {
  const u = new URL(direccion);
  // Los assets de Releases saltan de github.com al almacén de GitHub.
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('Redirección insegura');
  if (!['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'].includes(u.hostname)) {
    throw new Error('Redirección fuera de GitHub');
  }
  return u;
}

async function conPlazo(ms, trabajo) {
  const controlador = new AbortController();
  let reloj;
  try {
    return await Promise.race([
      trabajo(controlador.signal),
      new Promise((_, rechazar) => {
        reloj = setTimeout(() => { controlador.abort(); rechazar(new Error('Tiempo agotado')); }, ms);
      })
    ]);
  } finally {
    clearTimeout(reloj);
  }
}

async function pedir(url, fetchImpl, signal, { api = false } = {}) {
  let destino = new URL(url);
  for (let saltos = 0; saltos <= 5; saltos++) {
    if (api) {
      if (destino.protocol !== 'https:' || destino.hostname !== 'api.github.com') throw new Error('API inesperada');
    } else urlPermitida(destino.href);
    const respuesta = await fetchImpl(destino.href, {
      headers: { 'User-Agent': USER_AGENT, Accept: api ? 'application/vnd.github+json' : 'application/octet-stream' },
      redirect: 'manual', signal
    });
    if ([301, 302, 303, 307, 308].includes(respuesta.status)) {
      const lugar = respuesta.headers.get('location');
      if (!lugar) throw new Error('Redirección sin destino');
      destino = new URL(lugar, destino);
      // La API no tiene motivo para enviarnos a otro dominio.
      if (api) {
        if (destino.protocol !== 'https:' || destino.hostname !== 'api.github.com') throw new Error('API redirigida');
      } else urlPermitida(destino.href);
      continue;
    }
    if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
    return respuesta;
  }
  throw new Error('Demasiadas redirecciones');
}

async function leerHasta(respuesta, limite) {
  const trozos = [];
  let total = 0;
  if (!respuesta.body) throw new Error('Respuesta vacía');
  for await (const trozo of respuesta.body) {
    total += trozo.length;
    if (total > limite) throw new Error('Ficha demasiado grande');
    trozos.push(trozo);
  }
  return Buffer.concat(trozos).toString('utf8');
}

function datosFicha(texto, nombre, version) {
  // Sólo se interpretan los tres campos de la entrada exacta del instalador.
  // No se usa un parser YAML genérico ni se acepta una huella de otro asset.
  const versionFicha = /^version:\s*['"]?([^'"\r\n]+)['"]?\s*$/m.exec(texto)?.[1];
  if (versionFicha !== version) return null;
  const bloques = [...texto.matchAll(/^  - url:\s*['"]?([^'"\r\n]+)['"]?\s*\r?\n((?: {4}[^\r\n]*\r?\n?)*)/gm)];
  const bloque = bloques.find(([, url]) => url === nombre)?.[2];
  if (!bloque) return null;
  const sha512 = /^    sha512:\s*([A-Za-z0-9+/]{86}==)\s*$/m.exec(bloque)?.[1];
  const tamano = /^    size:\s*(\d+)\s*$/m.exec(bloque)?.[1];
  const size = Number(tamano);
  if (!sha512 || !Number.isSafeInteger(size) || size <= 0 || size > MAX_INSTALADOR) return null;
  return { sha512, size };
}

/** @returns { actual, nueva, disponible, instalador } */
async function buscar({ actual, repositorio = repositorioPorDefecto(), fetchImpl = globalThis.fetch,
  plazoConsulta = PLAZO_CONSULTA } = {}) {
  const sinNada = { actual, nueva: null, disponible: false, instalador: null };
  if (!/^[\w.-]+\/[\w.-]+$/.test(repositorio || '')) return sinNada;
  try {
    const release = await conPlazo(plazoConsulta, async signal => {
      const respuesta = await pedir(`https://api.github.com/repos/${repositorio}/releases/latest`, fetchImpl, signal, { api: true });
      return JSON.parse(await leerHasta(respuesta, MAX_FICHA));
    });
    const nueva = String(release.tag_name || '').replace(/^v/, '');
    if (!/^\d+(?:\.\d+){2,}(?:-\d+)?$/.test(nueva) || !esMasNueva(nueva, actual)) return sinNada;
    const nombre = `MyLAIberry-Setup-${nueva}.exe`;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const instalador = assets.find(a => a.name === nombre);
    const ficha = assets.find(a => a.name === 'latest.yml');
    if (!instalador || !ficha || !Number.isSafeInteger(instalador.size) || instalador.size <= 0 || instalador.size > MAX_INSTALADOR) return sinNada;
    const urlInstalador = urlPermitida(instalador.browser_download_url).href;
    const urlFicha = urlPermitida(ficha.browser_download_url).href;
    const texto = await conPlazo(plazoConsulta, async signal => leerHasta(await pedir(urlFicha, fetchImpl, signal), MAX_FICHA));
    const datos = datosFicha(texto, nombre, nueva);
    if (!datos || datos.size !== instalador.size) return sinNada;
    return { actual, nueva, disponible: true, instalador: urlInstalador, sha512: datos.sha512, size: datos.size };
  } catch {
    // Sin red, sin Release o con una ficha incompleta, Ajustes sólo indica
    // que no hay actualización; el lector sigue funcionando sin internet.
    return sinNada;
  }
}

/** Descarga a una carpeta nueva y ejecuta únicamente los bytes comprobados. */
async function instalar({ actual, lanzar, repositorio = repositorioPorDefecto(), fetchImpl = globalThis.fetch,
  directorioTemporal = os.tmpdir() } = {}) {
  const r = await buscar({ actual, repositorio, fetchImpl });
  if (!r.disponible) return { ok: false, error: 'No hay ninguna versión más nueva.' };
  let carpeta;
  try {
    carpeta = fs.mkdtempSync(path.join(directorioTemporal, 'mylaiberry-actualizar-'));
    const destino = path.join(carpeta, `MyLAIberry-Setup-${r.nueva}.exe`);
    await conPlazo(PLAZO_DESCARGA, async signal => {
      const respuesta = await pedir(r.instalador, fetchImpl, signal);
      if (!respuesta.body) throw new Error('Descarga vacía');
      const huella = crypto.createHash('sha512');
      let total = 0;
      const fd = fs.openSync(destino, 'wx');
      try {
        for await (const trozo of respuesta.body) {
          total += trozo.length;
          if (total > MAX_INSTALADOR || total > r.size) throw new Error('Tamaño incorrecto');
          huella.update(trozo);
          fs.writeSync(fd, trozo);
        }
      } finally { fs.closeSync(fd); }
      if (total !== r.size) throw new Error('Tamaño incorrecto');
      const esperada = Buffer.from(r.sha512, 'base64');
      const recibida = huella.digest();
      if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) throw new Error('Huella incorrecta');
    });
    await lanzar(destino, ['/S', '--force-run']);
    return { ok: true, version: r.nueva };
  } catch (e) {
    if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });
    return { ok: false, error: 'No se pudo instalar la actualización: ' + e.message };
  }
}

module.exports = { buscar, instalar, esMasNueva };
