const { crearVentana } = require('../user-agent.js');
const { GENERO, IDIOMA, FANDOM, CLASIFICACION } = require('../etiquetas.js');
const { cargarPagina, PACIENCIA, mientrasAvance, ejecutarAunqueNavegue } = require('./navegar.js');
const { numero: leerNumero } = require('./numeros.js');
const { exigirAlgoGuardado } = require('./guardado.js');

const delay = ms => new Promise(r => setTimeout(r, ms));

function extractStoryId(url) {
  const match = url.match(/\/s\/(\d+)/);
  return match ? match[1] : null;
}

function parseMeta(crudo) {
  const texto = (crudo || '').replace(/\s+/g, ' ').trim();

  const numero = (re) => {
    const m = texto.match(re);
    return m ? leerNumero(m[1]) : 0;
  };

  const tags = [];
  const rated = texto.match(/Rated:\s*(?:Fiction\s+)?([KTMA+]+)/i);
  if (rated) tags.push({ name: 'Rated ' + rated[1], category: CLASIFICACION });

  const CLAVES = /^(Chapters|Words|Reviews|Favs|Follows|Updated|Published|Status|id)\s*:/i;
  const trozos = texto.split(' - ').map(t => t.trim());
  const iRated = trozos.findIndex(t => /^Rated\s*:/i.test(t));
  const sueltos = trozos.slice(iRated + 1).filter(t => t && !CLAVES.test(t));
  if (sueltos[0]) tags.push({ name: sueltos[0], category: IDIOMA });

  if (sueltos[1]) sueltos[1].split('/').forEach(g => tags.push({ name: g.trim(), category: GENERO }));

  let crossover;
  if (iRated > 0) {
    const antes = trozos.slice(0, iRated).filter(Boolean);
    crossover = antes.some(t => /^crossover$/i.test(t));

    const fandom = antes[antes.length - 1];
    const nombres = crossover ? (fandom || '').split(' & ').map(f => f.trim()) : [fandom];
    for (const f of nombres) if (f && f.length < 60) tags.push({ name: f, category: FANDOM });
  }

  return {
    chapters: numero(/Chapters:\s*([\d,]+)/i),
    words:    numero(/Words:\s*([\d,]+)/i),
    favs:     numero(/Favs:\s*([\d,]+)/i),

    completa: /Status\s*:\s*Complete/i.test(texto),

    crossover,
    tags
  };
}

function portadaGrande(url) {
  if (!url || esPortadaGenerica(url)) return '';
  const absoluta = url.startsWith('/') ? `https://www.fanfiction.net${url}` : url;
  return absoluta.replace(/(\/image\/\d+\/)\d+\/?$/, '$1180/');
}

function esPortadaGenerica(url) {
  return /\/static\/images\//i.test(String(url || ''));
}

const LECTOR_FICHA = `${PACIENCIA}
  new Promise((resolve) => {
    let intentos = 0;
    const timer = setInterval(() => {
      if (!mlSigueCargando()) intentos++;
      const perfil = document.querySelector('#profile_top');
      const cuerpo = document.querySelector('#storytext');

      if ((perfil && cuerpo) || intentos > 20) {
        clearInterval(timer);
        try {
          const q = (s) => document.querySelector(s);
          const t = (el) => el ? el.textContent.trim() : '';
          const sel = q('#chap_select');
          const portada = q('#profile_top img.cimage');

          const avisoDelSitio = (document.body.innerText || '');
          const noExiste = !(perfil && cuerpo) && /story not found|story is unavailable|user does not exist/i.test(avisoDelSitio);

          resolve({
            listo: !!(perfil && cuerpo),
            noExiste,
            titulo:     t(q('#profile_top b') || q('#profile_top b.xcontrast_txt')),
            autor:      t(q('#profile_top a[href^="/u/"]') || q('#profile_top a.xcontrast_txt')),
            autorHref:  (function () {
              const a = q('#profile_top a[href^="/u/"]') || q('#profile_top a.xcontrast_txt');
              return a ? a.getAttribute('href') : '';
            })(),
            sinopsis:   t(q('#profile_top div.xcontrast_txt') || q('#profile_top > div:not([class])')),
            metaCrudo:  t(q('#profile_top span.xgray')),
            fandom:     t(q('#pre_story_links a:last-child')),
            portadaUrl: portada ? (portada.getAttribute('data-original') || portada.src || '') : '',
            opciones:   sel ? Array.from(sel.options).map(o => ({ valor: o.value, titulo: o.textContent.trim() })) : []
          });
        } catch (e) {
          resolve({ error: e.message });
        }
      }
    }, 1000);
  });
`;

function listaDeCapitulos(storyId, opciones, capitulosDeLaFicha) {
  const delDesplegable = opciones
    .map(o => ({ n: parseInt(o.valor, 10), titulo: o.titulo }))
    .filter(o => Number.isInteger(o.n) && o.n > 0);

  const total = Math.max(delDesplegable.length, capitulosDeLaFicha || 0) || 1;

  const chapters = [];
  for (let i = 1; i <= total; i++) {
    const enLista = delDesplegable.find(c => c.n === i);
    chapters.push({
      title: enLista ? enLista.titulo : `Capítulo ${i}`,
      url: `https://www.fanfiction.net/s/${storyId}/${i}`
    });
  }
  return chapters;
}

const { extraerSeriesDeFicha: extraerSeriesFFN } = require('./series-ffn.js');

function armarObra(storyId, ficha, meta, chapters) {
  const tags = [...meta.tags];
  if (ficha.fandom) tags.push({ name: ficha.fandom, category: FANDOM });

  return {
    title: ficha.titulo,
    author: ficha.autor || 'Autor desconocido',
    autorUrl: ficha.autorHref ? `https://www.fanfiction.net${ficha.autorHref}` : '',
    synopsis: ficha.sinopsis,
    coverUrl: portadaGrande(ficha.portadaUrl),
    url: `https://www.fanfiction.net/s/${storyId}`,
    chapters,
    source: 'FanFiction.net',
    tags,
    wordCount: meta.words,
    kudos: meta.favs,
    completa: meta.completa,
    series: Array.isArray(ficha.series) ? ficha.series : []
  };
}

async function pedirFicha(win, storyId, onProgress) {
  if (onProgress) onProgress({ step: 'loading', message: 'Cargando página de FanFiction.net...' });

  await cargarPagina(win, `https://www.fanfiction.net/s/${storyId}/1`);
  await delay(3000);

  const ficha = await ejecutarAunqueNavegue(win, LECTOR_FICHA);
  if (ficha.error) throw new Error(ficha.error);

  if (ficha.noExiste) {

    throw Object.assign(new Error('FanFiction.net dice que esta historia no existe o ya no se puede leer. Puede haberla borrado su autor.'), { noExiste: true });
  }
  if (!ficha.listo || !ficha.titulo) {
    throw new Error('FanFiction.net no devolvió la ficha de la historia. Puede ser una protección temporal: inténtalo en unos minutos.');
  }
  return ficha;
}

async function scrape(url, onProgress) {
  const storyId = extractStoryId(url);
  if (!storyId) {
    throw new Error('URL de FanFiction.net inválida. Debe contener /s/ID');
  }

  if (onProgress) onProgress({ step: 'init', message: 'Iniciando extracción de FanFiction.net...' });

  const win = crearVentana({
    width: 1200, height: 800, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const cerrar = () => { if (win && !win.isDestroyed()) win.destroy(); };

  try {
    const ficha = await mientrasAvance(win, pedirFicha(win, storyId, onProgress), 'FanFiction.net');
    try {
      const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
      const { JSDOM } = require('jsdom');
      ficha.series = extraerSeriesFFN(new JSDOM(html).window.document, `https://www.fanfiction.net/s/${storyId}`);
    } catch {
      ficha.series = [];
    }
    const meta = parseMeta(ficha.metaCrudo);
    const chapters = listaDeCapitulos(storyId, ficha.opciones, meta.chapters);

    if (onProgress) {
      onProgress({
        step: 'extracting',
        message: `${chapters.length} capítulos encontrados.`,
        details: ficha.titulo
      });
      onProgress({ step: 'done', message: 'Extracción completada.', details: `${chapters.length} capítulos` });
    }

    return armarObra(storyId, ficha, meta, chapters);
  } finally {

    cerrar();
  }
}

const LECTOR_AUTOR = `${PACIENCIA}
  new Promise((resolve) => {
    let intentos = 0;
    const timer = setInterval(() => {
      if (!mlSigueCargando()) intentos++;
      const filas = document.querySelectorAll('div.z-list.mystories');
      if (filas.length > 0 || intentos > 15) {
        clearInterval(timer);
        try {
          const obras = [];
          for (const fila of filas) {
            const enlace = fila.querySelector('a[href^="/s/"]');
            if (!enlace) continue;
            const partes = enlace.getAttribute('href').split('/');
            const id = partes[2];
            if (!id) continue;

            const contenedor = fila.querySelector('div.z-indent') || fila;
            const gris = contenedor.querySelector('div.xgray') || contenedor.querySelector('div');
            const metaTexto = gris ? gris.textContent.trim() : '';

            let sinopsis = contenedor.textContent.trim();
            if (metaTexto && sinopsis.endsWith(metaTexto)) {
              sinopsis = sinopsis.slice(0, sinopsis.length - metaTexto.length).trim();
            }

            const titulo = fila.querySelector('a.stitle') || enlace;

            obras.push({
              id,
              titulo: titulo.textContent.trim(),
              sinopsis,
              metaCrudo: metaTexto || contenedor.textContent.trim()
            });
          }
          resolve({ listo: filas.length > 0, nombre: document.title.split('|')[0].trim(), obras });
        } catch (e) {
          resolve({ error: e.message });
        }
      }
    }, 1000);
  });
`;

function urlDeAutor(url) {
  const m = String(url || '').match(/\/u\/(\d+)/);
  return m ? `https://www.fanfiction.net/u/${m[1]}/` : '';
}

async function leerAutor(autorUrl) {
  const m = String(autorUrl || '').match(/\/u\/(\d+)/);
  if (!m) throw new Error('URL de autor de FanFiction.net no válida');

  const win = crearVentana({
    width: 1200, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  try {
    const perfil = await mientrasAvance(win, cargarPagina(win, `https://www.fanfiction.net/u/${m[1]}/`)
      .then(() => delay(3000)).then(() => ejecutarAunqueNavegue(win, LECTOR_AUTOR)), 'FanFiction.net, perfil del autor');

    if (perfil.error) throw new Error(perfil.error);
    if (!perfil.listo) throw new Error('El perfil no devolvió obras (¿protección temporal?)');

    return {
      nombre: perfil.nombre,
      obras: perfil.obras.map(o => {
        const meta = parseMeta(o.metaCrudo);
        const total = meta.chapters || 1;
        return {
          idOrigen: o.id,
          title: o.titulo,
          synopsis: o.sinopsis,
          url: `https://www.fanfiction.net/s/${o.id}`,
          source: 'FanFiction.net',
          author: perfil.nombre,
          autorUrl: `https://www.fanfiction.net/u/${m[1]}/`,
          wordCount: meta.words,
          kudos: meta.favs,
          tags: meta.tags,
          completa: meta.completa,
          totalChapters: total,
          chapterList: Array.from({ length: total }, (_, i) => ({
            title: `Capítulo ${i + 1}`,
            url: `https://www.fanfiction.net/s/${o.id}/${i + 1}`
          }))
        };
      })
    };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

const LECTOR_CAPITULO = `${PACIENCIA}
  new Promise((resolve) => {
    let intentos = 0;
    const timer = setInterval(() => {
      if (!mlSigueCargando()) intentos++;
      const cuerpo = document.querySelector('#storytext') || document.querySelector('#storycontent');
      if (cuerpo || intentos > 15) {
        clearInterval(timer);
        resolve(cuerpo ? cuerpo.innerHTML : '');
      }
    }, 1000);
  });
`;

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn) {

  let guardados = 0;

  const win = crearVentana({
    width: 1200, height: 800, show: false,
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
      const content = await mientrasAvance(win, cargarPagina(win, chapters[i].url)
        .then(() => ejecutarAunqueNavegue(win, LECTOR_CAPITULO)), `FanFiction.net, capítulo ${i + 1}`);

      if (content && content.trim()) {

        if (await saveContentFn(fanficId, i, content) !== false) guardados++;
      } else {
        console.error(`[FFN] Capítulo ${i + 1} llegó vacío, no se guarda`);
      }

      await delay(Math.floor(Math.random() * 2000) + 1500);
    } catch (err) {

      if (err.limitado) throw err;
      console.error(`[FFN] Error cap ${i}:`, err.message);
    }
  }

  exigirAlgoGuardado(guardados, chapters.length, 'FanFiction.net');
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { scrape, downloadChapters, parseMeta, portadaGrande, esPortadaGenerica, leerAutor, urlDeAutor,
  LECTOR_FICHA, listaDeCapitulos, armarObra };
