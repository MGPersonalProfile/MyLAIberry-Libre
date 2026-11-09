const { sanitizarUrl, normalizarObraDeSerie } = require('../series/contrato.js');

const BASE = 'https://www.webnovel.com';

function extraerSeriesDeFicha(doc, urlObra) {
  if (!doc) return [];
  const series = [];
  const vistos = new Set();

  const contSeries = doc.querySelector('.m-series, .franchise-books, .series-collection');
  if (!contSeries) return [];

  const titEl = contSeries.querySelector('.series-tit, h3, h4');
  const nombre = (titEl?.textContent || '').replace(/\s+/g, ' ').trim() || 'Franquicia Webnovel';

  const enlaces = contSeries.querySelectorAll('a[href*="/book/"]');
  for (const a of enlaces) {
    const url = sanitizarUrl(a.getAttribute('href'), BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    const idMatch = url.match(/\/book\/(\d+)/i);
    const id = idMatch ? `webnovel_${idMatch[1]}` : url;

    series.push({
      id,
      fuente: 'Webnovel',
      nombre,
      url,
      parte: null,
      ordenConocido: false
    });
  }

  return series;
}

function extraerCatalogoDeSerie(doc, urlSerie) {
  if (!doc) return { nombre: 'Colección Webnovel', obras: [], ordenConocido: false, siguientePagina: null };
  const h1 = doc.querySelector('.series-tit, .det-hd h1, h1');
  const nombre = (h1?.textContent || '').replace(/\s+/g, ' ').trim() || 'Colección Webnovel';

  const items = doc.querySelectorAll('.series-list li, .franchise-books .item, .m-series li');
  const obras = [];
  const vistos = new Set();
  let hayOrden = false;

  for (let i = 0; i < items.length; i++) {
    const li = items[i];
    const a = li.querySelector('a[href*="/book/"]') || (li.tagName === 'A' ? li : null);
    if (!a) continue;
    const url = sanitizarUrl(a.getAttribute('href'), BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);

    const titulo = (a.textContent || '').replace(/\s+/g, ' ').trim() || `Libro ${i + 1}`;
    let posicion = null;
    const ordenEl = li.querySelector('.series-order, .num, [data-order]');
    const m = (ordenEl?.textContent || '').match(/(\d+)/);
    if (m) {
      posicion = Number(m[1]);
      hayOrden = true;
    }

    const norm = normalizarObraDeSerie({ url, titulo, posicion }, BASE);
    if (norm) obras.push(norm);
  }

  return {
    nombre,
    obras,
    ordenConocido: hayOrden,
    siguientePagina: null
  };
}

module.exports = {
  extraerSeriesDeFicha,
  extraerCatalogoDeSerie
};
