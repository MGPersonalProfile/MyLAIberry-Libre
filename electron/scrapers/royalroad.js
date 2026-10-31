const { BrowserWindow } = require('electron');
const { GENERO, completaDeEtiquetas } = require('../etiquetas.js');
const { cargarPagina, PACIENCIA, mientrasAvance, ejecutarAunqueNavegue } = require('./navegar.js');
const { exigirAlgoGuardado } = require('./guardado.js');

const { leerAutor, urlDeAutor } = require('./autor-royalroad.js');

const TOPE_PAGINAS = 60;

const GUION_METADATOS = `${PACIENCIA}
          new Promise((resolve) => {
            const ESTADOS = ['COMPLETED', 'ONGOING', 'HIATUS', 'STUB', 'DROPPED', 'INACTIVE'];
            const libro = () => {
              for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
                try { const d = JSON.parse(s.textContent); if (d && d.name && (d['@type'] === 'Book' || d.author)) return d; } catch (e) {}
              }
              return null;
            };
            let attempts = 0;
            const interval = setInterval(() => {
              if (!mlSigueCargando()) attempts++;
              const ld = libro();
              const titleEl = document.querySelector('h1[property="name"]') || document.querySelector('h1.font-white') || document.querySelector('h1');
              const lista = Array.isArray(window.chapters) ? window.chapters : null;
              const chaptersTable = document.querySelector('#chapters tbody');
              const hayTitulo = !!((ld && ld.name) || titleEl);
              const hayCapitulos = !!((lista && lista.length) || chaptersTable);

              if ((hayTitulo && hayCapitulos) || attempts > 20) {
                clearInterval(interval);

                if (!hayTitulo || !hayCapitulos) {
                  resolve({ error: !hayTitulo
                    ? 'RoyalRoad cargo la pagina pero no trae ninguna obra: puede que la direccion este mal o que la hayan retirado.'
                    : 'RoyalRoad cargo la obra pero no su lista de capitulos. Vuelve a intentarlo en un minuto.' });
                  return;
                }

                try {
                  const ui = document.querySelector('#beta-switch-btn') ? 'clasica' : 'nueva';
                  const autorLd = ld && ld.author ? ld.author : {};
                  const title = (ld && ld.name) || titleEl.innerText;
                  const author = autorLd.name || document.querySelector('span[property="name"]')?.innerText || document.querySelector('h4 a')?.innerText || '';
                  const autorHref = autorLd.url || autorLd['@id'] || document.querySelector('h4 a')?.getAttribute('href') || '';
                  const synopsis = (ld && ld.description)
                    || document.querySelector('[property="description"]')?.innerText
                    || document.querySelector('.description')?.innerText
                    || document.querySelector('meta[property="og:description"]')?.content || '';
                  const coverUrl = (ld && (typeof ld.image === 'string' ? ld.image : ld.image && ld.image.url))
                    || document.querySelector('meta[property="og:image"]')?.content
                    || document.querySelector('img[property="image"]')?.src
                    || document.querySelector('img.thumbnail')?.src || '';
                  const selectorGeneros = ui === 'clasica' ? 'a.fiction-tag' : 'a[href*="tagsAdd"]';
                  const generos = [...new Set([...document.querySelectorAll(selectorGeneros)]
                    .map(a => (a.innerText || '').trim()).filter(Boolean))];
                  const etiquetasEstado = ui === 'clasica'
                    ? [...document.querySelectorAll('span.label.label-sm')].map(e => (e.textContent || '').trim()).filter(Boolean)
                    : [...document.querySelectorAll('span')].map(e => (e.textContent || '').trim()).filter(t => ESTADOS.includes(t.toUpperCase())).slice(0, 2);
                  const capitulos = lista
                    ? lista.filter(c => c && c.url && c.visible !== 0).map(c => ({ title: String(c.title || '').trim(), url: new URL(c.url, location.origin).href }))
                    : null;

                  resolve({ ui, title, author, synopsis, coverUrl, generos, autorHref, etiquetasEstado, capitulos, url: window.location.href });
                } catch (e) {
                  resolve({ error: e.message });
                }
              }
            }, 1000);
          });
`;

const GUION_CIEN_POR_PAGINA = `
          (() => {
            const dropdownItems = document.querySelectorAll('.btn-default.dropdown-toggle ~ ul li a, .dropdown-menu li a');
            for (const item of dropdownItems) {
              if (item.textContent.trim() === '100') {
                item.click();
                return true;
              }
            }
            return false;
          })()
`;

const GUION_PAGINA = `
            (() => {
              const chapters = [];
              const tbody = document.querySelector('#chapters tbody');
              if (tbody) {
                tbody.querySelectorAll('tr').forEach(tr => {
                  const a = tr.querySelector('a');
                  if (a) {
                    chapters.push({
                      title: a.innerText.trim(),
                      url: a.href
                    });
                  }
                });
              }

              const tableFooter = document.querySelector('.table-footer');
              let hasNext = false;
              if (tableFooter) {
                const activePage = tableFooter.querySelector('.page-active');
                if (activePage && activePage.nextElementSibling) {
                  hasNext = true; // Hay una página siguiente
                }
              }

              return { chapters, hasNext };
            })()
`;

const GUION_SIGUIENTE = `
              (() => {
                const tableFooter = document.querySelector('.table-footer');
                const activePage = tableFooter?.querySelector('.page-active');
                const nextPage = activePage?.nextElementSibling;
                if (nextPage) {
                  const link = nextPage.querySelector('a') || nextPage;
                  link.click();
                }
              })()
`;

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

async function esperarTablaNueva(win, primeraAntes, msQuieta = 15000) {
  let quieta = 0, recursosAntes = -1;
  while (quieta < msQuieta) {
    await esperar(300);

    const ahora = await win.webContents.executeJavaScript(`
      (function () {
        var fila = document.querySelector('#chapters tbody tr a[href]');
        return { fila: fila ? fila.getAttribute('href') : null, recursos: performance.getEntriesByType('resource').length };
      })()
    `).catch(() => ({ fila: null, recursos: -2 }));
    if (ahora.fila && (!primeraAntes || !String(primeraAntes).endsWith(ahora.fila))) return true;
    quieta = ahora.recursos === recursosAntes ? quieta + 300 : 0;
    recursosAntes = ahora.recursos;
  }
  console.warn('[RoyalRoad] La tabla de capítulos no cambió y la página dejó de pedir nada; se sigue de todos modos.');
  return false;
}

async function recogerCapitulos(win, onProgress) {
  let todos = [];
  let pagina = 1;

  for (;;) {
    if (onProgress && pagina > 1) {
      onProgress({ step: 'pagination', message: `Cargando página ${pagina} de capítulos...` });
    }

    const datos = await win.webContents.executeJavaScript(GUION_PAGINA);

    const conocidas = new Set(todos.map(c => c.url));
    const nuevas = datos.chapters.filter(c => c.url && !conocidas.has(c.url));
    todos = todos.concat(nuevas);

    if (datos.chapters.length > 0 && nuevas.length === 0) {
      console.warn(`[RoyalRoad] La página ${pagina} no trajo capítulos nuevos: se deja de paginar.`);
      return todos;
    }
    if (pagina >= TOPE_PAGINAS) {
      console.warn(`[RoyalRoad] Se alcanzó el tope de ${TOPE_PAGINAS} páginas de índice.`);
      return todos;
    }
    if (!datos.hasNext) return todos;

    await win.webContents.executeJavaScript(GUION_SIGUIENTE);

    await esperarTablaNueva(win, datos.chapters[0]?.url);
    pagina++;
  }
}

async function recogerTabla(win, onProgress) {
  if (onProgress) onProgress({ step: 'pagination', message: 'Cargando lista completa de capítulos...' });
  await win.webContents.executeJavaScript(GUION_CIEN_POR_PAGINA);

  await esperar(2000);
  return recogerCapitulos(win, onProgress);
}

function armarResultado(metadata, capitulos) {

  const { generos, autorHref, etiquetasEstado, ui, capitulos: incrustados, ...resto } = metadata;

  resto.synopsis = String(resto.synopsis || '').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  const completa = completaDeEtiquetas(etiquetasEstado || []);
  const tags = (generos || []).map(name => ({ name, category: GENERO }));

  const autorUrl = autorHref
    ? new URL(autorHref, 'https://www.royalroad.com').href
    : undefined;

  return {
    ...resto,
    tags,
    ...(autorUrl ? { autorUrl } : {}),

    ...(completa !== undefined ? { completa } : {}),
    chapters: capitulos,
    source: 'RoyalRoad'
  };
}

async function leerFicha(win, onProgress) {
  if (onProgress) onProgress({ step: 'extracting', message: 'Extrayendo título, autor y capítulos...' });

  const metadata = await ejecutarAunqueNavegue(win, GUION_METADATOS);
  if (metadata.error) throw new Error(metadata.error);

  const capitulos = metadata.capitulos?.length ? metadata.capitulos : await recogerTabla(win, onProgress);
  const resultado = armarResultado(metadata, capitulos);

  if (onProgress) {
    onProgress({
      step: 'done',
      message: 'Extracción de metadatos completada.',
      details: `${capitulos.length} capítulos encontrados.`
    });
  }
  return resultado;
}

async function scrapeRoyalRoad(url, onProgress) {
  if (onProgress) onProgress({ step: 'init', message: 'Iniciando motor de extracción...' });
  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  try {
    if (onProgress) onProgress({ step: 'loading', message: 'Cargando página de RoyalRoad...' });
    await mientrasAvance(win, cargarPagina(win, url), 'RoyalRoad');
    return await mientrasAvance(win, leerFicha(win, onProgress), 'RoyalRoad');
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

const LECTOR_CAPITULO = `${PACIENCIA}
        new Promise((resolve) => {
          let attempts = 0;
          const interval = setInterval(() => {
            if (!mlSigueCargando()) attempts++;
            const chapterDiv = document.querySelector('.chapter-inner');
            if (chapterDiv || attempts > 15) {
              clearInterval(interval);
              if (!chapterDiv) { resolve(''); return; }
              chapterDiv.querySelectorAll('*').forEach(function (el) {
                var cs = window.getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') el.setAttribute('hidden', '');
              });
              resolve(chapterDiv.innerHTML);
            }
          }, 1000);
        });
`;

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {

  let guardados = 0;

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (onProgress) onProgress({
      step: 'downloading_chapters',
      message: `Descargando capítulo ${i + 1} de ${chapters.length}...`,
      details: chapter.title
    });

    try {
      const content = await mientrasAvance(win, cargarPagina(win, chapter.url)
        .then(() => ejecutarAunqueNavegue(win, LECTOR_CAPITULO)), `RoyalRoad, capítulo ${i + 1}`);

      if (content && content.trim()) {

        if (await saveContentFn(fanficId, i, content) !== false) guardados++;
      } else {
        console.error(`[RoyalRoad] El capítulo ${i + 1} llegó vacío; no se guarda.`);
      }

      const sleepTime = Math.floor(Math.random() * 1500) + 1000;
      await esperar(sleepTime);
    } catch (err) {

      if (err.limitado) throw err;
      console.error(`Error descargando cap ${i}:`, err);

    }
  }

  exigirAlgoGuardado(guardados, chapters.length, 'RoyalRoad');
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}
module.exports = {
  GUION_METADATOS, armarResultado,
  scrape: scrapeRoyalRoad,
  downloadChapters,
  leerAutor,
  urlDeAutor
};
