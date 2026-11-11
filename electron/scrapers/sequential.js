const { crearVentana } = require('../user-agent.js');
const { GENERO, completaDeEtiquetas } = require('../etiquetas.js');
const universal = require('./universal');
const { cargarPagina, mientrasAvance } = require('./navegar.js');

const CHAPTER_RE = /\/(chapter|capitulo|capítulo)-(\d+)(?:[/?#]|$)/i;

function palabraDeCapitulo(url) {
  const m = CHAPTER_RE.exec(String(url || ''));
  return m ? m[1].toLowerCase() : 'chapter';
}

const MIN_PALABRAS = 200;

const MIN_PALABRAS_UTILES = 20;

const VACIOS_PARA_PARAR = 3;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function cargar(win, url) {
  try {
    await mientrasAvance(win, cargarPagina(win, url), 'carga de página');
  } catch (err) {
    try { win.webContents.stop(); } catch {  }
    throw err;
  }
}

function seriesBase(url) {
  const limpio = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return limpio.replace(CHAPTER_RE, '');
}

function chapterUrl(base, n, palabra = 'chapter') {
  return `${base}/${palabra}-${n}`;
}

function limpiarSinopsis(bruta) {
  let t = String(bruta || '');

  const primeraEtiqueta = t.indexOf('<');
  if (primeraEtiqueta > 0) t = t.slice(primeraEtiqueta);

  return t

    .replace(/<\/p\s*>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function contarPalabras(html) {
  if (!html) return 0;
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!texto) return 0;

  const porEspacios = texto.split(' ').filter(Boolean).length;

  const cjk = (texto.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g) || []).length;

  return Math.max(porEspacios, cjk);
}

async function existe(enlace, n, win) {
  try {
    const page = await mientrasAvance(win, universal.extractPage(enlace(n), win), `capítulo ${n}`);
    return contarPalabras(page?.content) >= MIN_PALABRAS;
  } catch {
    try { win.webContents.stop(); } catch {  }
    return false;
  }
}

async function buscarUltimo(enlace, win, onProgress) {
  let alto = 1;
  if (!(await existe(enlace, 1, win))) return 0;

  while (await existe(enlace, alto * 2, win)) {
    alto *= 2;
    if (onProgress) onProgress({ step: 'pagination', message: `Buscando el final… (pasado el ${alto})` });
    if (alto > 8192) break;
  }

  return afinar(enlace, win, alto, alto * 2, onProgress);
}

async function afinar(enlace, win, bajo, alto, onProgress) {
  while (bajo + 1 < alto) {
    const medio = Math.floor((bajo + alto) / 2);
    if (await existe(enlace, medio, win)) bajo = medio; else alto = medio;
    if (onProgress) onProgress({ step: 'pagination', message: `Afinando el final… (${bajo}-${alto})` });
  }
  return bajo;
}

function finDelTramo(numeros) {
  const hay = new Set(numeros);
  const orden = [...hay].sort((a, b) => b - a);
  return orden.find(n => hay.has(n - 1)) ?? orden[0] ?? 0;
}

const GUION_FICHA = `
        (() => {
          const enlaces = [...document.querySelectorAll('a[href]')]
            .map(a => a.getAttribute('href') || '')
            .filter(h => h.length < 300);

          const og = (p) => document.querySelector('meta[property="og:' + p + '"]')?.content || '';
          const title = (og('title') || document.title || '')
            .replace(/\\s*[-–|]\\s*[^-–|]*$/, '')   // quita el " - Nombre Del Sitio" final
            .trim();

          const fila = (() => {
            for (const caja of document.querySelectorAll('div[class*="flex-wrap"]')) {
              const hijos = [...caja.children];
              const textos = hijos
                .filter(h => h.children.length === 0)
                .map(h => (h.textContent || '').trim())
                .filter(t => t && t.length < 30);
              if (textos.length >= 3) {
                const noHojas = hijos
                  .filter(h => h.children.length > 0)
                  .map(h => (h.textContent || '').trim())
                  .filter(t => t && t.length < 30);
                return { generos: textos, estado: noHojas };
              }
            }
            return { generos: [], estado: [] };
          })();
          const generos = fila.generos;
          const estado = fila.estado;

          const autor = (() => {
            for (const el of document.querySelectorAll('*')) {
              if (el.children.length) continue;
              if ((el.textContent || '').trim().toLowerCase() !== 'author') continue;
              const valor = (el.nextElementSibling && el.nextElementSibling.textContent || '').trim();
              if (valor && valor.length < 80) return valor;
            }
            return '';
          })();

          return {
            enlaces,
            title,
            autor,
            generos,
            estado,
            synopsis: (og('description') ||
                       document.querySelector('meta[name="description"]')?.content || '').trim(),
            coverUrl: og('image')
          };
        })()
`;

const { extraerSeriesDeFicha: extraerSeriesSeq } = require('./series-sequential.js');

async function leerFicha(win, base) {
  try {
    await cargar(win, base);
    await delay(1200);

    const info = await win.webContents.executeJavaScript(GUION_FICHA);

    let palabra = null;
    const numeros = [];
    for (const href of (info.enlaces || [])) {
      const m = CHAPTER_RE.exec(href);
      if (!m) continue;
      if (!palabra) palabra = m[1].toLowerCase();
      const n = parseInt(m[2], 10);
      if (Number.isFinite(n)) numeros.push(n);
    }

    let series = [];
    try {
      const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
      const { JSDOM } = require('jsdom');
      series = extraerSeriesSeq(new JSDOM(html).window.document, base);
    } catch {
      series = [];
    }

    return {
      palabra,
      masAlto: numeros.length ? Math.max(...numeros) : 0,
      tramo: finDelTramo(numeros),
      meta: {
        title: info.title,
        author: (info.autor || '').trim(),
        synopsis: limpiarSinopsis(info.synopsis),
        coverUrl: info.coverUrl,
        generos: info.generos || [],
        completa: completaDeEtiquetas(info.estado || []),
        series
      }
    };
  } catch {
    return { palabra: null, masAlto: 0, meta: {} };
  }
}

async function contarCapitulos(enlace, win, masAlto, onProgress, tramo = masAlto) {

  if (tramo > 0 && tramo < masAlto && await existe(enlace, tramo, win)) {
    if (onProgress) onProgress({ step: 'pagination', message: `El índice sigue seguido hasta el ${tramo}; comprobando…` });
    if (!await existe(enlace, tramo + 1, win)) return tramo;
    return await existe(enlace, masAlto, win)
      ? (await existe(enlace, masAlto + 1, win) ? buscarUltimo(enlace, win, onProgress) : masAlto)
      : afinar(enlace, win, tramo + 1, masAlto, onProgress);
  }
  if (masAlto > 0) {
    if (onProgress) onProgress({ step: 'pagination', message: `El índice llega al ${masAlto}; comprobando…` });
    if (await existe(enlace, masAlto, win)) {
      if (!await existe(enlace, masAlto + 1, win)) return masAlto;
      if (onProgress) onProgress({ step: 'pagination', message: 'Hay más de los que lista el índice; buscando el final…' });
      return buscarUltimo(enlace, win, onProgress);
    }
  }

  if (onProgress) onProgress({ step: 'pagination', message: 'El índice no sirve; buscando el final a ciegas…' });
  return buscarUltimo(enlace, win, onProgress);
}

function sitioDe(base) {
  try { return new URL(base).hostname.replace(/^www\./, ''); } catch { return 'Sitio'; }
}

async function scrape(url, onProgress) {
  const base = seriesBase(url);

  const palabraDeLaUrl = CHAPTER_RE.test(url) ? palabraDeCapitulo(url) : null;

  const win = crearVentana({
    width: 900, height: 700, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  try {
    if (onProgress) onProgress({ step: 'init', message: 'Leyendo la ficha de la serie…' });

    const { palabra, masAlto, tramo, meta } = await leerFicha(win, base);

    const enlace = (n) => chapterUrl(base, n, palabraDeLaUrl || palabra || 'chapter');

    const total = await contarCapitulos(enlace, win, masAlto, onProgress, tramo);
    if (total === 0) throw new Error('No se encontró ningún capítulo en esta dirección');

    const chapters = Array.from({ length: total }, (_, i) => ({
      title: `Capítulo ${i + 1}`,
      url: enlace(i + 1)
    }));

    if (onProgress) onProgress({ step: 'done', message: `${total} capítulos encontrados.` });

    const host = sitioDe(base);
    return {
      title: meta.title || host,
      author: meta.author || 'Traducción — ' + host,
      synopsis: meta.synopsis || '',
      coverUrl: meta.coverUrl || '',

      tags: (meta.generos || []).map(name => ({ name, category: GENERO })),
      ...(meta.completa !== undefined ? { completa: meta.completa } : {}),
      url: base,
      source: host,
      chapters,
      series: Array.isArray(meta.series) ? meta.series : []
    };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {
  const win = crearVentana({
    width: 900, height: 700, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let vaciosSeguidos = 0;

  try {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      if (onProgress) {
        onProgress({
          step: 'downloading_chapters',
          message: `Descargando capítulo ${i + 1} de ${chapters.length}…`,
          details: chapter.title
        });
      }

      try {
        const page = await mientrasAvance(win, universal.extractPage(chapter.url, win), `capítulo ${i + 1}`);
        const html = page?.content || '';
        const palabras = contarPalabras(html);

        if (html.trim()) {
          await saveContentFn(fanficId, i, html);
        }

        if (palabras >= MIN_PALABRAS_UTILES || html.trim()) {
          vaciosSeguidos = 0;
        } else {
          vaciosSeguidos++;
          if (onProgress) {
            onProgress({ step: 'info', message: `El capítulo ${i + 1} vino vacío.` });
          }
          if (vaciosSeguidos >= VACIOS_PARA_PARAR) {
            if (onProgress) {
              onProgress({ step: 'info', message: `${VACIOS_PARA_PARAR} capítulos vacíos seguidos: la novela se acaba aquí.` });
            }
            break;
          }
        }
      } catch (err) {
        console.error(`[sequential] Error en el capítulo ${i + 1}:`, err.message);

        if (err.noExiste && ++vaciosSeguidos >= VACIOS_PARA_PARAR) break;
      }

      await delay(Math.floor(Math.random() * 1200) + 800);
    }
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { scrape, downloadChapters, seriesBase, buscarUltimo, contarPalabras, finDelTramo };
