const { sanitizarUrl, normalizarObraDeSerie } = require('../series/contrato.js');

const BASE = 'https://wetriedtls.com';

function esCapituloDeNovela(url) {
  if (!url) return false;
  return /\/(?:chapter|capitulo|capítulo)-\d+/i.test(url);
}

function extraerSeriesDeFicha(doc, urlObra) {

  if (esCapituloDeNovela(urlObra)) {
    return [];
  }
  if (!doc) return [];

  const coleccion = doc.querySelector('.franchise-series, .novel-collection');
  if (!coleccion) return [];

  const titEl = coleccion.querySelector('h2, h3, .collection-title');
  const nombre = (titEl?.textContent || '').replace(/\s+/g, ' ').trim() || 'Saga WeTriedTLs';

  const series = [];
  const vistos = new Set();
  for (const a of coleccion.querySelectorAll('a[href*="/series/"]')) {
    const href = a.getAttribute('href') || '';
    if (esCapituloDeNovela(href)) continue;
    const url = sanitizarUrl(href, BASE);
    if (!url || vistos.has(url) || url === sanitizarUrl(urlObra, BASE)) continue;
    vistos.add(url);
    const idMatch = url.match(/\/series\/([^/]+)/i);
    const id = idMatch ? `wetried_${idMatch[1]}` : url;
    series.push({
      id,
      fuente: 'WeTriedTLs',
      nombre,
      url,
      parte: null,
      ordenConocido: false
    });
  }

  return series;
}

function extraerCatalogoDeSerie(doc, urlSerie) {
  if (!doc) return { nombre: 'Saga WeTriedTLs', obras: [], ordenConocido: false, siguientePagina: null };
  const h1 = doc.querySelector('h1, .collection-title');
  const nombre = (h1?.textContent || '').replace(/\s+/g, ' ').trim() || 'Saga WeTriedTLs';

  const enlaces = doc.querySelectorAll('.franchise-series a[href*="/series/"], .novel-collection a[href*="/series/"]');
  const obras = [];
  const vistos = new Set();
  let pos = 1;

  for (const a of enlaces) {
    const href = a.getAttribute('href') || '';
    if (esCapituloDeNovela(href)) continue;
    const url = sanitizarUrl(href, BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);

    const titulo = (a.textContent || '').replace(/\s+/g, ' ').trim() || `Novela ${pos}`;
    const norm = normalizarObraDeSerie({ url, titulo, posicion: pos }, BASE);
    if (norm) {
      obras.push(norm);
      pos++;
    }
  }

  return {
    nombre,
    obras,
    ordenConocido: obras.length > 0,
    siguientePagina: null
  };
}

module.exports = {
  esCapituloDeNovela,
  extraerSeriesDeFicha,
  extraerCatalogoDeSerie
};
