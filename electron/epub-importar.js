const crypto = require('crypto');
const path = require('path');
const { leerCapitulos, leerMetadatos, lectoresJsdom } = require('./epub.js');
const { htmlDeEpubAo3 } = require('./epub-ao3.js');

function leerMetadatosDe(buffer) {
  const p = lectoresJsdom();
  try { return leerMetadatos(buffer, p); } catch { return {}; } finally { p.cerrar(); }
}

const PREFIJO = 'epub:';

function esDelDisco(url) {
  return /^(epub|pdf|ao3-html|texto):/.test(String(url || ''));
}

function tituloDelFichero(nombre) {
  return path.basename(String(nombre || ''), path.extname(String(nombre || '')))
    .replace(/[_]+/g, ' ').trim() || 'EPUB sin título';
}

async function obraDeEpub(buffer, nombre) {

  const htmlAo3 = htmlDeEpubAo3(buffer);
  if (htmlAo3) {
    const { obraDeHtmlAo3 } = require('./html-ao3-importar.js');
    const obra = obraDeHtmlAo3(Buffer.from(htmlAo3, 'utf8'));
    const idioma = leerMetadatosDe(buffer).language;
    return { ...obra, ...(idioma ? { language: idioma } : {}) };
  }
  const p = lectoresJsdom();
  let meta, capitulos;
  try {
    meta = leerMetadatos(buffer, p);
    capitulos = await leerCapitulos(buffer, p);
  } finally {
    p.cerrar();
  }
  if (!capitulos.length) {
    throw new Error('Ese EPUB no trae ningún capítulo con texto que se pueda leer.');
  }
  const huella = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  return {
    title: meta.title || tituloDelFichero(nombre),
    author: meta.author || '',
    synopsis: meta.synopsis || '',
    language: meta.language || '',
    url: PREFIJO + huella,
    source: 'EPUB',
    chapters: capitulos.map(c => ({ title: c.title, url: '' })),
    chapterContents: capitulos.map(c => c.content)
  };
}

module.exports = { obraDeEpub, esDelDisco };
