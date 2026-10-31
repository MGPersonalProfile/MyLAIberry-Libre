const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const { parsearDescarga } = require('./scrapers/ao3.js');

const ERROR_HTML = 'Ese HTML no es una descarga de AO3: debe incluir los metadatos y los capítulos de Archive of Our Own.';

function idDeUrl(valor) {
  try {
    const url = new URL(valor, 'https://archiveofourown.org');
    if (!['archiveofourown.org', 'www.archiveofourown.org', 'download.archiveofourown.org'].includes(url.hostname)) return null;
    return url.pathname.match(/^\/works\/(\d+)(?:\/|$)/)?.[1]
      || url.pathname.match(/^\/downloads\/(\d+)\/[^/]+\.html?$/i)?.[1] || null;
  } catch { return null; }
}

function obraDeHtmlAo3(buffer, urlOrigen) {
  const html = buffer.toString('utf8');
  const doc = new JSDOM(html).window.document;
  const meta = doc.querySelector('.meta');
  if (!meta || !/Archive of Our Own/i.test(html)) throw new Error(ERROR_HTML);

  const mensajes = [...doc.querySelectorAll('#preface .message a[href], #afterword .message a[href]')]
    .map(a => a.getAttribute('href'));
  const enlaces = [...mensajes, doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    urlOrigen];
  const workId = enlaces.map(idDeUrl).find(Boolean);
  const local = 'ao3-html:' + crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  const obra = parsearDescarga(html, workId, local);
  if (!obra.title || !obra.chapters.length || obra.chapterContents.every(c => !c.trim())) throw new Error(ERROR_HTML);
  return { ...obra, source: 'AO3' };
}

module.exports = { obraDeHtmlAo3, ERROR_HTML };
