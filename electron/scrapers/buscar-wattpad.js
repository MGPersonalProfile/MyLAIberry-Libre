const { JSDOM } = require('jsdom');
const { numero } = require('./numeros');
const { exigirQueNoSeaUnReto } = require('./navegar');

function urlDeBusqueda({ consulta }) {
  return `https://www.wattpad.com/search/stories?query=${encodeURIComponent(consulta)}`;
}

function resultadosDeHtml(html) {
  const doc = new JSDOM(html).window.document;
  const tarjetas = [...doc.querySelectorAll('a.story-card[href^="/story/"]')];
  if (!tarjetas.length) exigirQueNoSeaUnReto('Wattpad', { titulo: doc.title, texto: doc.body?.textContent, url: 'https://www.wattpad.com/' });
  return tarjetas.map(a => {
    const id = (a.getAttribute('href').match(/^\/story\/(\d+)/) || [])[1];
    if (!id) return null;
    const text = selector => (a.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
    const stats = [...a.querySelectorAll('.stats-item')].map(el => el.textContent.replace(/\s+/g, ' '));
    const dato = etiqueta => numero((stats.find(s => new RegExp(etiqueta, 'i').test(s)) || '').match(/[\d,.]+[kKmM]?/)?.[0]);
    return { idOrigen: id, title: text('.title'), synopsis: text('.description'),
      url: `https://www.wattpad.com/story/${id}`, source: 'Wattpad', author: '',
      kudos: dato('votes'), reads: dato('reads'), totalChapters: dato('parts'),
      completa: !!a.querySelector('.completed'), tags: [], chapterList: [] };
  }).filter(o => o?.title);
}

function fichaDeHtml(html, url) {
  const doc = new JSDOM(html).window.document;
  const text = selector => (doc.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
  const autor = doc.querySelector('a[href*="/user/"]');
  const tags = [...doc.querySelectorAll('[data-testid="tags"] a[href]')]
    .map(a => ({ name: a.textContent.trim(), category: 'freeform' })).filter(t => t.name);
  return { title: text('h1[data-testid="title"]') || text('h1'), author: autor?.textContent.trim() || '',
    autorUrl: autor?.href || '', synopsis: doc.querySelector('meta[name="description"]')?.content || '',
    tags, url, source: 'Wattpad', totalChapters: numero(text('[data-testid="partsCount"]')) || 0 };
}

async function buscar({ consulta, url } = {}) {
  if (!url && !String(consulta || '').trim()) return [];
  const { BrowserWindow } = require('electron');
  const { cargarPagina } = require('./navegar');
  const win = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  try {
    await cargarPagina(win, url || urlDeBusqueda({ consulta }));
    await new Promise(r => setTimeout(r, 3000));
    return resultadosDeHtml(await win.webContents.executeJavaScript('document.documentElement.outerHTML'));
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { buscar, urlDeBusqueda, resultadosDeHtml, fichaDeHtml };
