const { JSDOM } = require('jsdom');

const ORIGEN = 'https://www.webnovel.com';
const PARTICION = 'webnovel-busqueda';
const IDIOMA = 'en-US,en';

function urlDeBusqueda({ consulta, pagina = 1 }) {
  const p = new URLSearchParams({ keywords: String(consulta || '').trim() });
  if (pagina > 1) p.set('pageIndex', String(pagina));
  return `${ORIGEN}/search?${p}`;
}

function urlDeTarjeta(href) {
  const m = String(href || '').match(/\/book\/([^/?#]*_)?(\d{10,})/);
  if (!m) return null;
  return `${ORIGEN}/book/${m[1] || ''}${m[2]}`;
}

function autoresDeItemList(doc) {
  const autores = new Map();
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let j;
    try { j = JSON.parse(s.textContent); } catch { continue; }
    const listas = [j, ...(j['@graph'] || [])].filter(x => x && x['@type'] === 'ItemList');
    for (const l of listas) {
      for (const el of l.itemListElement || []) {
        const id = (String(el.url || '').match(/_(\d{10,})/) || [])[1];
        const autor = el.author?.name;
        if (id && autor) autores.set(id, String(autor).trim());
      }
    }
  }
  return autores;
}

function resultadosDeHtml(html) {
  const doc = new JSDOM(html).window.document;
  const autores = autoresDeItemList(doc);
  const vistas = new Set();
  const obras = [];
  for (const portada of doc.querySelectorAll('a[data-search-type="book"]')) {
    const li = portada.closest('li') || portada.parentElement;
    const url = urlDeTarjeta(portada.getAttribute('href'));
    const id = portada.getAttribute('data-bookid') || (url && url.match(/(\d{10,})$/)[1]);
    if (!url || !id || vistas.has(id)) continue;
    vistas.add(id);
    const texto = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const titulo = portada.getAttribute('data-bookname') || portada.getAttribute('title') || texto(li.querySelector('h3'));
    if (!titulo) continue;
    let portadaUrl = li.querySelector('img')?.getAttribute('src') || '';
    if (portadaUrl.startsWith('//')) portadaUrl = 'https:' + portadaUrl;
    obras.push({
      idOrigen: id,
      title: titulo.trim(),
      author: autores.get(id) || '',
      synopsis: texto(li.querySelector('p.fs16')),
      url,
      source: 'Webnovel',

      sinCifras: ['kudos', 'wordCount', 'totalChapters'],
      coverUrl: portadaUrl,

      nota: Number(texto(li.querySelector('.g_star_num small'))) || undefined,
      tags: [...li.querySelectorAll('.g_tags a')].map(a => texto(a)).filter(Boolean)
        .map(t => ({ name: t.charAt(0) + t.slice(1).toLowerCase(), category: 'freeform' })),
      chapterList: []
    });
  }
  return obras;
}

const ESPERAR_TARJETAS = () => `(function () { ${require('./navegar.js').PACIENCIA}
  return new Promise(function (resolve) {
    var intentos = 0;
    var t = setInterval(function () {
      if (!mlSigueCargando()) intentos++;
      var hay = document.querySelectorAll('a[data-search-type="book"]').length > 0;
      if (hay || intentos > 15) {
        clearInterval(t);
        resolve(document.documentElement.outerHTML);
      }
    }, 300);
  });
})()`;

async function buscar({ consulta, pagina = 1 } = {}) {
  if (!String(consulta || '').trim()) return [];

  const { BrowserWindow, session } = require('electron');
  const { cargarPagina, exigirQueNoSeaUnReto, muestraDePagina, mientrasAvance } = require('./navegar.js');
  const ses = session.fromPartition(PARTICION);

  ses.setUserAgent(require('../sesiones.js').sinMarcaDeElectron(ses.getUserAgent()), IDIOMA);
  const win = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true } });
  try {
    const url = urlDeBusqueda({ consulta, pagina });
    const html = await mientrasAvance(win, (async () => {
      await cargarPagina(win, url);
      return win.webContents.executeJavaScript(ESPERAR_TARJETAS());
    })(), 'Webnovel');
    const obras = resultadosDeHtml(html);

    if (!obras.length) exigirQueNoSeaUnReto('Webnovel', { ...(await muestraDePagina(win)), url });
    return relevantes(obras, consulta);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function relevantes(obras, consulta) {
  const { pertinencia } = require('../relevancia.js');
  return obras.filter(o => pertinencia(o, consulta) === 1);
}

module.exports = { buscar, urlDeBusqueda, resultadosDeHtml, relevantes, urlDeTarjeta, PARTICION };
