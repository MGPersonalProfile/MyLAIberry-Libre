const { JSDOM } = require('jsdom');

function clasificarTipoPagina(html, url = '') {
  if (!html || html.length < 15 || /p[aá]gina vac[ií]a|error 404/i.test(html)) {
    return 'insuficiente';
  }
  const u = String(url).toLowerCase();
  const esRecUrl = u.includes('/recs/') || u.includes('recommend');
  const esWiki = u.includes('fanlore.org') || u.includes('tvtropes.org');

  if (esRecUrl || /recomiend|recommend|favorite\s+fics|best\s+fics/i.test(html)) {
    return 'recomienda';
  }
  if (esWiki || /is a classic|fanfiction and multimedia|chronicles the school years/i.test(html)) {
    return 'describe';
  }
  const textoVisible = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (textoVisible.length >= 10 && (/<a\s+[^>]*href=[^>]+>[^<]{2,}<\/a>|<h[1-6][^>]*>[^<]{2,}<\/h[1-6]>/i.test(html) || /mencion|fic|novel|story|obra|worm/i.test(textoVisible))) {
    return 'menciona_titulo';
  }
  return 'insuficiente';
}

function parsearObrasDeLista(doc, procedencia) {
  const items = doc.querySelectorAll('li, .rec-entry, dt');
  const obras = [];

  for (const el of items) {
    const enlace = el.querySelector('a');
    if (!enlace) continue;
    const url = enlace.getAttribute('href') || '';
    const titulo = enlace.textContent.trim();
    if (!titulo || !url) continue;

    let descripcion = '';
    const descEl = el.querySelector('.desc, p, blockquote');
    if (descEl) {
      descripcion = descEl.textContent.trim();
    } else if (el.tagName.toLowerCase() === 'dt' && el.nextElementSibling?.tagName?.toLowerCase() === 'dd') {
      descripcion = el.nextElementSibling.textContent.trim();
    } else {

      const clon = el.cloneNode(true);
      clon.querySelectorAll('ul, ol, dl').forEach(sub => sub.remove());
      const aRemover = clon.querySelector('a');
      if (aRemover) aRemover.remove();
      descripcion = clon.textContent.trim().replace(/^by\s+[A-Za-z0-9_-]+\.?\s*/i, '');
    }

    const textoAutor = el.tagName.toLowerCase() === 'dt' ? `${el.textContent} ${el.nextElementSibling?.textContent || ''}` : el.textContent;
    const autorMatch = textoAutor.match(/\bby\s+([A-Za-z0-9_-]+)/i);
    const autor = autorMatch ? autorMatch[1].trim() : '';

    obras.push({
      titulo,
      url,
      autor,
      descripcion,
      procedencia
    });
  }

  return obras;
}

function analizarPaginaRecomendaciones(html, url = '') {
  const tipoPagina = clasificarTipoPagina(html, url);
  if (tipoPagina === 'insuficiente') {
    return { tipoPagina, obras: [], url };
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const obras = parsearObrasDeLista(doc, url);

  return {
    tipoPagina,
    url,
    obras
  };
}

module.exports = {
  clasificarTipoPagina,
  analizarPaginaRecomendaciones,
  parsearObrasDeLista
};
