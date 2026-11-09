const { sanitizarUrl, normalizarObraDeSerie } = require('../series/contrato.js');

const BASE = 'https://www.fanfiction.net';

function extraerSeriesDeFicha(doc, urlObra) {
  if (!doc) return [];
  const series = [];
  const vistos = new Set();
  const urlActualNorm = sanitizarUrl(urlObra, BASE);

  const top = doc.querySelector('#profile_top, .xcontrast_txt');
  if (!top) return [];

  const enlaces = top.querySelectorAll('a[href*="/s/"]');
  for (const a of enlaces) {
    const url = sanitizarUrl(a.getAttribute('href'), BASE);
    if (!url || url === urlActualNorm || vistos.has(url)) continue;

    const cont = a.closest('div, p') || a.parentElement;
    const txt = (cont?.textContent || '').replace(/\s+/g, ' ');
    const esSecuela = /sequel\s+to/i.test(txt);
    const esPrecuela = /prequel\s+to/i.test(txt);
    const parteMatch = txt.match(/(?:part|book|libro|parte)\s+(\d+)/i);

    if (esSecuela || esPrecuela || parteMatch) {
      vistos.add(url);
      const idMatch = url.match(/\/s\/(\d+)/i);
      const id = idMatch ? `ffn_${idMatch[1]}` : url;
      const nombreObra = (a.textContent || '').replace(/\s+/g, ' ').trim() || 'Obra Relacionada';
      const parte = parteMatch ? Number(parteMatch[1]) : null;
      series.push({
        id,
        fuente: 'FanFiction.net',
        nombre: `Saga: ${nombreObra}`,
        url,
        parte,
        ordenConocido: parte !== null
      });
    }
  }

  return series;
}

function extraerCatalogoDeSerie(doc, urlSerie) {
  if (!doc) return { nombre: 'Saga FFN', obras: [], ordenConocido: false, siguientePagina: null };
  const h1 = doc.querySelector('#profile_top b, h1');
  const nombre = (h1?.textContent || '').replace(/\s+/g, ' ').trim() || 'Saga FanFiction.net';

  const enlaces = doc.querySelectorAll('#profile_top a[href*="/s/"], .z-list a[href*="/s/"]');
  const obras = [];
  const vistos = new Set();

  for (const a of enlaces) {
    const url = sanitizarUrl(a.getAttribute('href'), BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    const titulo = (a.textContent || '').replace(/\s+/g, ' ').trim() || 'Obra';
    const contTxt = ((a.parentElement?.textContent || '') + ' ' + (a.textContent || '')).replace(/\s+/g, ' ');
    const parteMatch = contTxt.match(/(?:part|book|libro|parte)\s+(\d+)/i);
    const posicion = parteMatch ? Number(parteMatch[1]) : null;
    const norm = normalizarObraDeSerie({ url, titulo, posicion }, BASE);
    if (norm) {
      obras.push(norm);
    }
  }

  return {
    nombre,
    obras,
    ordenConocido: obras.some(o => o.posicion !== null),
    siguientePagina: null
  };
}

module.exports = {
  extraerSeriesDeFicha,
  extraerCatalogoDeSerie
};
