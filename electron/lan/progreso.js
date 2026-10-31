const { esIdValido } = require('./rutas-seguras.js');

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
  if (!numero(p.en) || p.en > ahora + 60_000) return null;
  return { obra: p.obra, capitulo: p.capitulo, ancla, en: Math.round(p.en) };
}

function mismoOrigen(req) {
  const origen = req.headers.origin;
  if (!origen) return false;
  try {
    return new URL(origen).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
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
  return (await guardar(p)) ? [204, ''] : [409, 'Llegó tarde: ya hay una lectura más reciente.'];
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
