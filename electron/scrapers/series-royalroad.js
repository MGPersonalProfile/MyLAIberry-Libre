const { sanitizarUrl, normalizarObraDeSerie } = require('../series/contrato.js');

const BASE = 'https://www.royalroad.com';

function extraerSeriesDeFicha(doc, urlObra) {
  if (!doc) return [];
  const series = [];
  const vistos = new Set();

  const enlacesSerie = doc.querySelectorAll('a[href*="/fiction/series/"], a[href*="/series/"], .fiction-series a');
  for (const a of enlacesSerie) {
    const href = a.getAttribute('href') || '';
    if (href.includes('/chapter-')) continue;
    const url = sanitizarUrl(href, BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    const idMatch = url.match(/\/(?:fiction\/)?series\/(\d+)/i);
    const id = idMatch ? idMatch[1] : url;
    const nombre = (a.textContent || '').replace(/\s+/g, ' ').trim() || 'Serie RoyalRoad';

    let parte = null;
    const cont = a.closest('.fiction-series, .series-item, .series-badge');
    if (cont) {
      const txt = (cont.textContent || '').replace(/\s+/g, ' ');
      const m = txt.match(/\b(?:part|libro|book)\s+(\d+)\b/i);
      if (m) parte = Number(m[1]);
    }
    series.push({ id, fuente: 'RoyalRoad', nombre, url, parte, ordenConocido: parte !== null });
  }

  if (!series.length) {
    const enlacesRel = doc.querySelectorAll('.related-fictions a[href*="/fiction/"], .portlet-body a[href*="/fiction/"]');
    for (const a of enlacesRel) {
      const url = sanitizarUrl(a.getAttribute('href'), BASE);
      if (!url || vistos.has(url) || url === sanitizarUrl(urlObra, BASE)) continue;
      vistos.add(url);
      const nombre = (a.textContent || '').replace(/\s+/g, ' ').trim() || 'Obra Relacionada';
      const idMatch = url.match(/\/fiction\/(\d+)/i);
      const id = idMatch ? `rr_${idMatch[1]}` : url;
      series.push({ id, fuente: 'RoyalRoad', nombre: `Saga: ${nombre}`, url, parte: null, ordenConocido: false });
    }
  }

  return series;
}

function leerTotalDeclarado(doc) {
  const metaTotal = doc.querySelector('.series-meta, [data-total]');
  if (!metaTotal) return null;
  const dt = metaTotal.getAttribute('data-total');
  if (dt && /^\d+$/.test(dt.trim())) return Number(dt.trim());
  const m = String(metaTotal.textContent || '').match(/total(?:\s+works)?:\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function extraerCatalogoDeSerie(doc, urlSerie) {
  if (!doc) return { nombre: 'Serie', obras: [], ordenConocido: false, siguientePagina: null };
  const h1 = doc.querySelector('h1.font-white, h1, .series-header h1');
  const nombre = (h1?.textContent || '').replace(/\s+/g, ' ').trim() || 'Serie RoyalRoad';
  const totalDeclarado = leerTotalDeclarado(doc);

  const items = doc.querySelectorAll('.fiction-list-item, .item, .work-list .work, .work-entry, .fiction-list > div, .related-works .work-entry, .series-works a, .series-works .work');
  const candidatos = [...items];

  const obras = [];
  const vistos = new Set();
  let hayOrdenExplicito = false;

  for (let i = 0; i < candidatos.length; i++) {
    const el = candidatos[i];
    const a = el.tagName === 'A' ? el : el.querySelector('a[href*="/fiction/"]');
    if (!a) continue;
    const href = a.getAttribute('href') || '';
    if (href.includes('/chapter-') || href.includes('/series/')) continue;
    const url = sanitizarUrl(href, BASE);
    if (!url || vistos.has(url)) continue;
    vistos.add(url);

    const titulo = (a.textContent || '').replace(/\s+/g, ' ').trim() || `Obra ${i + 1}`;

    let posicion = null;
    const ordenEl = el.querySelector('.series-order, .pos, [data-order]');
    const rawOrden = ordenEl?.getAttribute('data-order') || ordenEl?.textContent || '';
    const m = rawOrden.match(/(\d+)/);
    if (m) {
      posicion = Number(m[1]);
      hayOrdenExplicito = true;
    }

    const obraNorm = normalizarObraDeSerie({ url, titulo, posicion }, BASE);
    if (obraNorm) obras.push(obraNorm);
  }

  let siguientePagina = null;
  const nextLink = doc.querySelector('.pagination a[rel="next"], .pagination li.active + li a');
  if (nextLink) {
    siguientePagina = sanitizarUrl(nextLink.getAttribute('href'), urlSerie);
  }

  return {
    nombre,
    obras,
    ordenConocido: hayOrdenExplicito,
    siguientePagina,
    totalDeclarado
  };
}

module.exports = {
  extraerSeriesDeFicha,
  extraerCatalogoDeSerie
};
