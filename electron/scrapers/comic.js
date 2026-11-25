const { conDisco } = require('../barrera-disco.js');
const { guardarCapituloComic, generarHtmlCapituloComic } = require('../db.js');
const { leerImagenComic } = require('./comic-imagenes.js');

function urlHttp(entrada) {
  if (typeof entrada !== 'string') return null;
  try {
    const url = new URL(entrada.trim());
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

function datosComic(meta, capitulos, opciones = {}) {
  const ids = new Set(Array.isArray(opciones.episodios) ? opciones.episodios.map(String) : []);
  const seleccion = ids.size ? capitulos.filter(c => ids.has(c.episodeNo)) : capitulos;
  return {
    ...meta, tipo: 'comic', esComic: true,
    chapters: seleccion.map((c, index) => ({ ...c, index })),
    totalChapters: seleccion.length,
    ...(ids.size ? { episodiosElegidos: seleccion.map(c => c.episodeNo) } : {})
  };
}

const tituloCapitulo = (numero, idioma) => numero
  ? `${idioma === 'en' ? 'Chapter' : 'Capítulo'} ${numero}`
  : idioma === 'en' ? 'Unnumbered chapter' : 'Capítulo sin numerar';

function nombreImagen(indice, ext) {
  return `${String(indice + 1).padStart(4, '0')}.${ext}`;
}

async function bajarVinhetas(ch, fuente, obtenerVinhetas, referer) {
  const vinhetas = await obtenerVinhetas(ch);
  if (!vinhetas.length) throw new Error(`${fuente} · 0 ${ch.idioma === 'en' ? 'panels' : 'viñetas'}`);
  const imagenes = [];
  for (const [indice, v] of vinhetas.entries()) {
    const { buffer, mime, ext } = await leerImagenComic(v.url, { referer: referer?.(ch), fuente });
    imagenes.push({ archivo: nombreImagen(indice, ext), buffer, mime, ancho: v.ancho, alto: v.alto });
  }
  return imagenes;
}

function descargadorComic({ fuente, obtenerVinhetas, idDeObra, referer }) {
  return async function downloadChapters(chapters, fanficId, onProgress, saveContentFn, desde = 0) {
    let guardados = 0, algunoEnDisco = false;
    for (const [i, ch] of (chapters || []).entries()) {
      const indice = desde + i;

      if (ch.yaEnDisco) { algunoEnDisco = true; continue; }
      if (ch.dePago) { onProgress?.({ step: 'info', message: `${ch.title}: de pago o anticipado, se salta.` }); continue; }
      onProgress?.({
        step: 'downloading_chapter', message: `${ch.title} (${i + 1}/${chapters.length})`,
        downloaded: indice, total: chapters.length
      });
      let imagenes;
      try {
        imagenes = await bajarVinhetas(ch, fuente, obtenerVinhetas, referer);
      } catch (err) {
        if (err.limitado || err.reto) throw err;
        if (err.dePago) { onProgress?.({ step: 'info', message: `${ch.title}: de pago o anticipado, se salta.` }); continue; }
        throw new Error(`${ch.title} · ${err.message}`, { cause: err });
      }
      await conDisco(() => guardarCapituloComic(fanficId, indice, {
        fuente, titleNo: idDeObra?.(ch.url), episodio: ch.numero ?? ch.episodeNo ?? String(indice + 1),
        url: ch.url, imagenes, totalEsperadas: imagenes.length
      }));
      await saveContentFn(fanficId, i, generarHtmlCapituloComic(fanficId, indice, imagenes));
      guardados++;
    }
    if (guardados === 0 && !algunoEnDisco && (chapters || []).length > 0) {
      throw new Error(`${fuente} · no se descargó ningún capítulo (todos de pago o sin viñetas)`);
    }
  };
}

module.exports = { urlHttp, datosComic, tituloCapitulo, descargadorComic };
