const { seriesDe } = require('./ao3-series.js');
const { sanitizarUrl, normalizarObraDeSerie } = require('../series/contrato.js');

const BASE = 'https://archiveofourown.org';

function extraerSeriesDeFicha(doc, urlObra) {
  const lista = seriesDe(doc);
  return lista.map(s => ({
    id: s.id,
    fuente: 'Archive of Our Own',
    nombre: s.nombre,
    url: s.url,
    parte: s.parte,
    ordenConocido: s.parte !== null
  }));
}

function extraerCatalogoDeSerie(doc, urlSerie, offset) {
  if (!doc) return { nombre: 'Serie AO3', obras: [], ordenConocido: false, siguientePagina: null };
  const h2 = doc.querySelector('h2.heading, h2');
  const nombre = (h2?.textContent || '').replace(/\s+/g, ' ').trim() || 'Serie AO3';

  let totalDeclarado = null;
  const metaWorks = doc.querySelector('dl.series.meta dd');
  if (metaWorks) {
    const m = metaWorks.textContent.match(/Works:\s*(\d+)/i);
    if (m) totalDeclarado = Number(m[1]);
  }

  const filas = doc.querySelectorAll('ul.series.work.index.group > li, ol.work.index.group > li, li.work.blurb.group');
  const obras = [];
  const vistos = new Set();
  let basePos = typeof offset === 'number' ? offset : 0;
  if (typeof offset !== 'number' && urlSerie) {
    const mPag = String(urlSerie).match(/[?&]page=(\d+)/i);
    if (mPag) basePos = (Math.max(1, parseInt(mPag[1], 10)) - 1) * 20;
  }
  let pos = basePos + 1;

  for (const li of filas) {
    const a = li.querySelector('h4.heading a[href*="/works/"]');
    if (!a) continue;
    const url = sanitizarUrl(a.getAttribute('href'), BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);

    const titulo = (a.textContent || '').replace(/\s+/g, ' ').trim() || `Obra ${pos}`;
    const norm = normalizarObraDeSerie({ url, titulo, posicion: pos }, BASE);
    if (norm) {
      obras.push(norm);
      pos++;
    }
  }

  const nextA = doc.querySelector('ol.pagination a[rel="next"], .pagination a[rel="next"]');
  const siguientePagina = nextA ? sanitizarUrl(nextA.getAttribute('href'), urlSerie) : null;

  return {
    nombre,
    obras,
    ordenConocido: obras.length > 0,
    siguientePagina,
    totalDeclarado
  };
}

module.exports = {
  extraerSeriesDeFicha,
  extraerCatalogoDeSerie
};
