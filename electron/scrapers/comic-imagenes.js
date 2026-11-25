const { pedirComic } = require('./comic-red.js');
const { cabeceras } = require('../user-agent.js');

const FUENTES_CON_NAVEGADOR = new Set(['asura']);

const extensiones = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

async function leerImagenComic(url, { fuente = 'webtoon', referer, minimo = 500 } = {}) {
  const headers = cabeceras({}, { clienteApi: fuente === 'mangadex' });
  if (referer) {
    headers['Referer'] = referer;
  }

  return pedirComic(url, async res => {
    const declarado = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const mime = Object.hasOwn(extensiones, declarado) ? declarado : fuente === 'webtoon' ? 'image/jpeg' : '';
    if (!mime) throw new Error(`${new URL(url).hostname} · ${declarado || 'Content-Type'}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error(`${new URL(url).hostname} · 0 B`);
    return { buffer, mime, ext: extensiones[mime] };
  }, { headers, minimo, redirect: fuente === 'webtoon' ? 'follow' : 'error', esperaDatos: true,
    navegador: FUENTES_CON_NAVEGADOR.has(fuente) });
}

async function descargarImagen(url, opciones = {}) {
  const referer = opciones.referer !== undefined ? opciones.referer : 'https://www.webtoons.com/';
  const { buffer } = await leerImagenComic(url, { ...opciones, referer });
  return buffer;
}

module.exports = { descargarImagen, leerImagenComic };
