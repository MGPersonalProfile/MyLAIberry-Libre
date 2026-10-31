const crypto = require('crypto');
const path = require('path');
const { leerCapitulos, leerMetadatos, lectoresJsdom } = require('./epub.js');

const PREFIJO = 'epub:';

function esDelDisco(url) {
  return /^(epub|pdf):/.test(String(url || ''));
}

function tituloDelFichero(nombre) {
  return path.basename(String(nombre || ''), path.extname(String(nombre || '')))
    .replace(/[_]+/g, ' ').trim() || 'EPUB sin título';
}

async function obraDeEpub(buffer, nombre) {
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
