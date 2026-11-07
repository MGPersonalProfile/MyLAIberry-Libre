const { esIdValido } = require('./rutas-seguras.js');
const { posicionValida } = require('../lector/posicion.js');

const MAXIMO = 2048;

const numero = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function anclaValida(a) {
  if (a == null) return null;
  if (!Number.isInteger(a.indice) || a.indice < 0 || !Number.isInteger(a.total) || a.total < 1
    || !numero(a.fraccion) || a.fraccion > 1) return undefined;
  return { indice: a.indice, fraccion: a.fraccion, total: a.total };
}

function progresoValido(p, ahora = Date.now()) {
  if (!p || typeof p !== 'object') return null;
  if (!esIdValido(p.obra) || !Number.isInteger(p.capitulo) || p.capitulo < 0 || p.capitulo > 100000) return null;
  const ancla = anclaValida(p.ancla);
  if (ancla === undefined) return null;
  if (p.deviceId !== undefined || p.mutationId !== undefined || p.baseRevision !== undefined) {
    if (typeof p.deviceId !== 'string' || !/^[\w-]{1,80}$/.test(p.deviceId)
      || typeof p.mutationId !== 'string' || !/^[\w-]{1,80}$/.test(p.mutationId)
      || !Number.isInteger(p.baseRevision) || p.baseRevision < 0) return null;
    const posicion = p.posicion === undefined ? undefined : posicionValida(p.posicion);
    if (posicion === null || (posicion?.v === 2 && (posicion.obra !== p.obra
      || posicion.capitulo !== p.capitulo))) return null;
    return { obra: p.obra, capitulo: p.capitulo, ancla, deviceId: p.deviceId,
      mutationId: p.mutationId, baseRevision: p.baseRevision, posicion };
  }
  if (!numero(p.en) || p.en > ahora + 60_000) return null;
  return { obra: p.obra, capitulo: p.capitulo, ancla, en: Math.round(p.en) };
}

function mismoOrigen(req) {
  const origen = req.headers.origin;
  if (!origen) return false;
  try {
    const u = new URL(origen);
    if (u.host.toLowerCase() !== String(req.headers.host || '').toLowerCase()) return false;
    const esHttps = !!(req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https');
    if (esHttps && u.protocol !== 'https:') return false;
    return true;
  } catch {
    return false;
  }
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    const trozos = [];
    let largo = 0;
    req.on('data', (t) => {
      largo += t.length;
      if (largo > MAXIMO) { mal(new Error('grande')); req.destroy(); return; }
      trozos.push(t);
    });
    req.on('end', () => ok(Buffer.concat(trozos).toString('utf-8')));
    req.on('error', mal);
  });
}

async function atenderProgreso(req, guardar) {
  if (typeof guardar !== 'function') return [404, 'No hay nada aquí.'];
  if (!mismoOrigen(req)) return [403, 'Origen no permitido.'];
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return [415, 'Sólo JSON.'];
  if (Number(req.headers['content-length'] || 0) > MAXIMO) return [413, 'Demasiado grande.'];
  let cuerpo;
  try {
    cuerpo = JSON.parse(await leerCuerpo(req));
  } catch {
    return [400, 'Cuerpo no válido.'];
  }
  const p = progresoValido(cuerpo);
  if (!p) return [400, 'Progreso no válido.'];
  const resultado = await guardar(p);
  if (resultado && typeof resultado === 'object') {
    return [resultado.aceptada ? 204 : 409,
      resultado.aceptada ? '' : 'Conflicto de revisión.', resultado];
  }
  return resultado ? [204, ''] : [409, 'Llegó tarde: ya hay una lectura más reciente.'];
}

const TOPE_DE_DRENAJE = 8 * 1024 * 1024;
const PLAZO_DE_DRENAJE = 10000;
function drenar(req) {
  return new Promise((resolver) => {
    if (req.readableEnded || req.complete) return resolver();

    const listo = () => {
      clearTimeout(plazo);
      for (const [ev, fn] of [['data', alLeer], ['end', listo], ['error', listo], ['close', listo]]) req.off(ev, fn);
      resolver();
    };
    let visto = 0;

    const plazo = setTimeout(listo, PLAZO_DE_DRENAJE);
    plazo.unref?.();
    const alLeer = (t) => { visto += t.length; if (visto > TOPE_DE_DRENAJE) { listo(); req.destroy(); } };
    req.on('data', alLeer);
    req.on('end', listo);
    req.on('error', listo);
    req.on('close', listo);
    req.resume();
  });
}

module.exports = { atenderProgreso, progresoValido, mismoOrigen, drenar };
