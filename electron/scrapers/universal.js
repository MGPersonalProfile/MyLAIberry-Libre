const { BrowserWindow } = require('electron');
const fs = require('fs');
const { cargarPagina, PACIENCIA, mientrasAvance } = require('./navegar.js');
const { exigirAlgoGuardado } = require('./guardado.js');
const { textoPlano } = require('../capitulo-valido.js');

let readabilitySource = null;
function getReadabilitySource() {
  if (!readabilitySource) {
    const readabilityPath = require.resolve('@mozilla/readability/Readability.js');
    readabilitySource = fs.readFileSync(readabilityPath, 'utf-8');
  }
  return readabilitySource;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

const GUION_ESPERA = `${PACIENCIA}
    new Promise(resolve => {
      let attempts = 0;
      const check = setInterval(() => {
        if (!mlSigueCargando()) attempts++;
        const body = document.body;
        if ((body && body.innerText.length > 500) || attempts > 12) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
`;

const guionDeLectura = (source) => `
    (function() {
      ${source}

      try {
        const docClone = document.cloneNode(true);
        const reader = new Readability(docClone);
        const article = reader.parse();

        if (article) {
          return {
            title: article.title || document.title,
            content: article.content || '',
            byline: article.byline || '',
            excerpt: article.excerpt || '',
            siteName: article.siteName || location.hostname,
            textLength: article.textContent ? article.textContent.length : 0
          };
        }
        return {
          title: document.title,
          content: '',
          byline: '',
          excerpt: '',
          siteName: location.hostname,
          textLength: 0,
          motivo: 'Readability no encontró contenido legible en esta página'
        };
      } catch(e) {
        return {
          title: document.title,
          content: '',
          byline: '',
          excerpt: '',
          siteName: location.hostname,
          textLength: 0,
          error: e.message
        };
      }
    })()
`;

async function extractPage(url, win) {
  await cargarPagina(win, url);

  await delay(2000);
  await win.webContents.executeJavaScript(GUION_ESPERA);

  const leer = () => win.webContents.executeJavaScript(guionDeLectura(getReadabilitySource()));
  const primera = await leer();

  if (textoPlano(primera?.content).length >= 200) return primera;
  await delay(6000);
  const segunda = await leer();
  return textoPlano(segunda?.content).length > textoPlano(primera?.content).length ? segunda : primera;
}

async function extractLinks(url, win) {
  await cargarPagina(win, url);
  await delay(2000);

  const links = await win.webContents.executeJavaScript(`
    (() => {
      const seen = new Set();
      return Array.from(document.querySelectorAll('a[href]'))
        .filter(a => {
          const text = a.textContent.trim();
          const href = a.href;
          if (!text || text.length < 2 || href.startsWith('javascript:') || href === '#') return false;
          if (seen.has(href)) return false;
          seen.add(href);
          return true;
        })
        .map(a => ({
          title: a.textContent.trim().substring(0, 200),
          url: a.href
        }));
    })()
  `);

  return links;
}

function detectChapterLinks(links, sourceUrl) {
  const sourceDomain = new URL(sourceUrl).hostname;

  const sameDomainsLinks = links.filter(l => {
    try { return new URL(l.url).hostname === sourceDomain; } catch { return false; }
  });

  const chapterPatterns = [
    /chapter[\s-_]*(\d+)/i,
    /cap[íi]?tulo[\s-_]*(\d+)/i,
    /cap[\s.-]*(\d+)/i,
    /ch[\s.-]*(\d+)/i,
    /part[\s-_]*(\d+)/i,
    /episode[\s-_]*(\d+)/i,
    /^\d+[\s.-]/,
    /[\s.-]\d+$/,
  ];

  const scored = sameDomainsLinks.map(link => {
    let score = 0;
    const text = link.title.toLowerCase();
    const url = link.url.toLowerCase();

    for (const pattern of chapterPatterns) {
      if (pattern.test(text) || pattern.test(url)) {
        score += 10;
        break;
      }
    }

    if (/\d+/.test(link.title)) score += 3;

    if (/\b(pr[óo]logo|prologue|ep[íi]logo|epilogue|interludio|interlude|omake|side[\s-]?story|extra|ap[ée]ndice|appendix|glosario|glossary)\b/i.test(text)
        || /\/(prologo|prologue|epilogo|epilogue|interlude|omake|extra)(-|\/|$)/i.test(url)) {
      score += 10;
    }

    if (/\/\d+\/?$/.test(link.url)) score += 5;

    if (link.title.length < 5) score -= 5;

    const navWords = ['home', 'about', 'contact', 'login', 'search', 'tag', 'category', 'comment'];
    if (navWords.some(w => text.includes(w))) score -= 10;

    return { ...link, score };
  });

  const capitulos = scored.filter(l => l.score > 0);

  const numeros = capitulos.map(l => numeroDeCapitulo(l));
  const todosNumerados = numeros.every(n => n !== null);
  const sinRepetir = new Set(numeros).size === numeros.length;

  if (todosNumerados && sinRepetir) {
    return capitulos
      .map((l, i) => ({ l, n: numeros[i] }))
      .sort((a, b) => a.n - b.n)
      .map(x => x.l);
  }

  return capitulos;
}

function numeroDeCapitulo(link) {
  const marcado = /(?:chapter|cap[íi]?tulo|cap|ch|part|episode|ep)[\s\-_.]*(\d{1,5})(?!\d)/i;

  const enUrl = String(link.url || '').match(marcado);
  if (enUrl) return Number(enUrl[1]);

  const enTitulo = String(link.title || '').match(marcado);
  if (enTitulo) return Number(enTitulo[1]);

  const alPrincipio = String(link.title || '').trim().match(/^(\d{1,5})(?!\d)/);
  if (alPrincipio) return Number(alPrincipio[1]);

  const finalUrl = String(link.url || '').match(/\/(\d{1,5})\/?$/);
  if (finalUrl) return Number(finalUrl[1]);

  return null;
}

function obraLeida(url, contenido) {
  return {
    author: contenido.byline || contenido.siteName || 'Autor desconocido',
    synopsis: contenido.excerpt || '',
    coverUrl: '',
    url,
    source: contenido.siteName || 'Web',
    isUniversal: true
  };
}

async function scrape(url, onProgress) {
  if (onProgress) onProgress({ step: 'init', message: 'Iniciando extractor universal...' });

  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  try {
    if (onProgress) onProgress({ step: 'loading', message: 'Cargando página...' });

    const contenido = await mientrasAvance(win, extractPage(url, win), 'página principal');

    if (onProgress) onProgress({ step: 'detecting', message: 'Buscando capítulos...' });
    await mientrasAvance(win, cargarPagina(win, url), 'carga de la página');
    await delay(1500);
    const enlaces = await mientrasAvance(win, extractLinks(url, win), 'lectura de enlaces');
    const candidatos = detectChapterLinks(enlaces, url);

    if (candidatos.length > 2) {
      if (onProgress) {
        onProgress({
          step: 'done',
          message: `${candidatos.length} posibles capítulos detectados.`,
          details: contenido.title
        });
      }
      return {
        ...obraLeida(url, contenido),
        title: contenido.title || 'Historia sin título',
        chapters: candidatos.map(c => ({ title: c.title, url: c.url })),

        needsChapterSelection: candidatos.length > 20
      };
    }

    if (onProgress) {
      onProgress({ step: 'done', message: 'Contenido extraído.', details: contenido.title });
    }
    return {
      ...obraLeida(url, contenido),
      title: contenido.title || 'Lectura sin título',
      chapters: [{ title: contenido.title, url }],
      chapterContents: [contenido.content]
    };
  } finally {

    if (win && !win.isDestroyed()) win.destroy();
  }
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {

  let guardados = 0;
  let win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  try {
  for (let i = 0; i < chapters.length; i++) {
    if (onProgress) {
      onProgress({
        step: 'downloading_chapters',
        message: `Descargando capítulo ${i + 1} de ${chapters.length}...`,
        details: chapters[i].title
      });
    }

    try {
      const page = await mientrasAvance(win, extractPage(chapters[i].url, win), `capítulo ${i + 1}`);
      const html = page?.content || '';

      if (html.trim()) {

        if (await saveContentFn(fanficId, i, html) !== false) guardados++;
      } else {

        console.error(`[Universal] El capítulo ${i + 1} llegó vacío; no se guarda.` +
          (page?.motivo ? ` (${page.motivo})` : ''));
      }
      await delay(Math.floor(Math.random() * 1500) + 1000);
    } catch (err) {
      console.error(`[Universal] Error cap ${i}:`, err.message);
      try { win.webContents.stop(); } catch {  }
    }
  }

  exigirAlgoGuardado(guardados, chapters.length, 'El sitio');
  } finally {

    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = {
  scrape,
  downloadChapters,
  extractPage,
  extractLinks,
  detectChapterLinks
};
