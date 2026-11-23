const { conRitmo, sitioDe, exigirQueNoSeaUnReto, limitado, enfriar } = require('./navegar.js');
const { cabeceras } = require('../user-agent.js');
const { detectarReto } = require('../asistente-reto.js');
const { JSDOM } = require('jsdom');

async function comprobarRespuesta(res, url, esperaDatos) {
  const cfMitigated = res.headers.get('cf-mitigated') || '';
  const mime = res.headers.get('content-type') || '';
  const html = /text\/html/i.test(mime);
  const host = new URL(url).hostname;
  if (cfMitigated || (html && (!res.ok || esperaDatos)) || (res.status === 403 && /text\/plain/i.test(mime))) {
    const texto = await res.text();
    const doc = html ? new JSDOM(texto).window.document : undefined;
    const senales = { titulo: doc?.title, cfMitigated, url, documento: doc };
    if (detectarReto(senales)) exigirQueNoSeaUnReto(host, senales);
    if (/bot challenge not passed|Powered by\s+(?:<[^>]+>\s*)?POWBlock/i.test(texto)) {
      throw Object.assign(new Error(`${host} · POWBlock`), { reto: true, noConsultado: true, sitio: sitioDe(url) });
    }
    if (res.ok) throw new Error(`${host} · ${mime}`);
  }
  if ([418, 429].includes(res.status)) {
    const err = limitado(url, res.status);
    const retryAfter = res.headers.get('retry-after');
    const ms = Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
    const reinicio = Number(res.headers.get('x-ratelimit-retry-after')) * 1000 - Date.now();
    const intervalo = Math.max(ms || 0, reinicio || 0);
    if (intervalo > err.esperarMs) {
      enfriar(url, Date.now() + intervalo - err.esperarMs);
      err.esperarMs = intervalo;
    }
    throw err;
  }
  if (!res.ok) throw new Error(`${host} · HTTP ${res.status}`);
}

async function pedirComic(url, leer, { headers = cabeceras(), minimo, redirect = 'error', esperaDatos = false } = {}) {
  return conRitmo(url, async () => {
    const res = await fetch(url, { headers, redirect, signal: AbortSignal.timeout(60000) });
    await comprobarRespuesta(res, url, esperaDatos);
    return leer(res);
  }, minimo);
}

module.exports = { pedirComic };
