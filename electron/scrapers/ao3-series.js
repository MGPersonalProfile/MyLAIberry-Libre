const BASE = 'https://archiveofourown.org';

function seriesDe(doc) {
  const sitios = [...doc.querySelectorAll('dd.series')];
  for (const dt of doc.querySelectorAll('dt')) {
    if (/^\s*series:?\s*$/i.test(dt.textContent || '') && dt.nextElementSibling && !sitios.includes(dt.nextElementSibling)) {
      sitios.push(dt.nextElementSibling);
    }
  }
  const series = [];
  for (const dd of sitios) {
    for (const a of dd.querySelectorAll('a[href*="/series/"]')) {
      const id = (a.getAttribute('href') || '').match(/\/series\/(\d+)/);
      if (!id || series.some(s => s.id === id[1])) continue;
      const parte = textoAntes(a).match(/part\s+(\d+)\s+of\s*(?:the\s*)?$/i);
      series.push({ id: id[1], nombre: (a.textContent || '').replace(/\s+/g, ' ').trim(), url: `${BASE}/series/${id[1]}`,
        parte: parte ? Number(parte[1]) : null });
    }
  }
  return series;
}

function textoAntes(a) {
  let texto = '';
  for (let n = a.previousSibling; n && texto.length < 60; n = n.previousSibling) {
    if (n.nodeType === 1 && n.tagName === 'A') break;
    texto = (n.textContent || '') + texto;
  }
  return texto.replace(/\s+/g, ' ');
}

function describirSerie(s) {
  return s.parte ? `Parte ${s.parte} de «${s.nombre}»` : `De la serie «${s.nombre}»`;
}

module.exports = { seriesDe, describirSerie };
