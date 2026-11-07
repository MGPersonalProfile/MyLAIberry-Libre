const { conRitmo } = require('./navegar.js');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function descargarImagen(url, opciones = {}) {
  const referer = opciones.referer !== undefined ? opciones.referer : 'https://www.webtoons.com/';
  const headers = {
    'User-Agent': USER_AGENT
  };
  if (referer) {
    headers['Referer'] = referer;
  }

  return await conRitmo(url, async () => {
    const res = await fetch(url, { headers });
    if (res.status === 403) {
      throw new Error(`Webtoon denegó la descarga (403 Forbidden). Comprueba la sesión o el Referer: ${url}`);
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 5;
      throw Object.assign(new Error(`Webtoon está limitando peticiones (429). Esperar ${wait}s`), { limitado: true, esperarMs: wait * 1000 });
    }
    if (!res.ok) {
      throw new Error(`Error descargando imagen de Webtoon (${res.status}): ${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }, opciones.minimo || 500);
}

module.exports = {
  descargarImagen,
  USER_AGENT
};
