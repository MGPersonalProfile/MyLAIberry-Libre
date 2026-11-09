const { BrowserWindow } = require('electron');
const { cargarPagina } = require('./navegar.js');
const { completaDelTitulo } = require('../etiquetas.js');
const { ordenarIndice } = require('./webnovel-indice.js');

const ESPERA_SPA = 11000;

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

const ES_CAPITULO = /_\d{10,}\/[^/]+_\d{10,}/;

function idDeLibro(url) {

  const m = String(url || '').match(/\/book\/(?:[^/]*_)?(\d{10,})/);
  return m ? m[1] : null;
}

function urlDeLibro(url) {
  const m = String(url || '').match(/^(https?:\/\/[^/]+(?:\/[a-z]{2})?\/book\/(?:[^/]+_)?\d{10,})/i);
  return m ? m[1] : null;
}

function limpiarAutor(crudo) {
  const t = String(crudo || '')
    .replace(/^\s*(autor|author|escritor|writer)\s*[::]\s*/i, '')
    .replace(/\s+(más|mas|more)\s*$/i, '')
    .trim();
  return t || 'Autor desconocido';
}

function nueva() {
  return new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
}

async function mirar(url, guion, espera = ESPERA_SPA) {
  const win = nueva();
  try {
    await cargarPagina(win, url);
    await dormir(espera);
    return await win.webContents.executeJavaScript(guion);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

const ENLACES = [
  '[].slice.call(document.querySelectorAll("a[href]")).map(function (a) {',
  '  return {',
  '    href: a.getAttribute("href") || "",',
  '    texto: (a.textContent || "").split(/\\s+/).join(" ").trim(),',
  '    candado: !!(a.querySelector("svg use") || a.querySelector("[class*=lock]"))',
  '  };',
  '})'
].join('\n');

const FICHA = [
  '(function () {',
  '  function texto(sel) {',
  '    var el = document.querySelector(sel);',
  '    return el ? (el.textContent || "").split(/\\s+/).join(" ").trim() : "";',
  '  }',
  '  // OpenGraph PRIMERO, las clases despues.',
  '  //',
  '  // Webnovel ofusca sus nombres de clase: son hashes que cambian con cada',
  '  // despliegue, y por eso aqui se buscaban por trozo ([class*=book]). Eso',
  '  // tiene dos problemas: se rompe igual cuando cambian, y por el camino casa',
  '  // con cosas que no son -un banner promocional dentro de un div que lleve',
  '  // "book" en la clase acaba siendo la portada de la obra-.',
  '  //',
  '  // Las etiquetas de OpenGraph no las tocan: las leen Google y las redes,',
  '  // y cambiarlas les cuesta trafico. Son el dato mas estable que publica',
  '  // este sitio, y ademas dicen exactamente lo que dicen.',
  '  function meta(prop) {',
  '    var el = document.querySelector("meta[property=\\"og:" + prop + "\\"]");',
  '    return el ? (el.getAttribute("content") || "").trim() : "";',
  '  }',
  '  var img = document.querySelector("[class*=book] img, .g_thumb img, img[data-original]");',
  '  var src = img ? (img.getAttribute("src") || img.getAttribute("data-original") || "") : "";',
  '  if (src.indexOf("//") === 0) src = "https:" + src;',
  '  return {',
  '    titulo: meta("title") || texto("h1"),',
  '    autor: texto("[class*=author] a") || texto("address") || texto("[class*=_author]"),',
  '    sinopsis: meta("description") || texto("[class*=synopsis] p") || texto("[class*=description]") || texto(".j_synopsis"),',
  '    portada: meta("image") || src',
  '  };',
  '})()'
].join('\n');

const CAPITULO = [
  '(function () {',
  '  var sel = document.querySelector(".cha-words") ||',
  '            document.querySelector(".cha-content") ||',
  '            document.querySelector(".j_chapter_content");',
  '  return {',
  '    html: sel ? sel.innerHTML : "",',
  '    texto: sel ? sel.textContent : ""',
  '  };',
  '})()'
].join('\n');

const { extraerSeriesDeFicha: extraerSeriesWN } = require('./series-webnovel.js');

async function scrape(url, onProgress) {
  const libro = urlDeLibro(url);
  if (!libro) throw new Error('Esa dirección de Webnovel no lleva a ninguna novela');

  const avisar = (message, step = 'loading') => onProgress && onProgress({ step, message });

  avisar('Abriendo la novela en Webnovel…');
  const ficha = await mirar(libro, FICHA);

  let series = [];
  try {
    const html = await mirar(libro, 'document.documentElement.outerHTML');
    const { JSDOM } = require('jsdom');
    series = extraerSeriesWN(new JSDOM(html).window.document, libro);
  } catch {
    series = [];
  }

  avisar('Leyendo el índice de capítulos…', 'extracting');
  const crudos = await mirar(libro + '/catalog', ENLACES);

  const vistos = new Set();
  const entradas = [];
  for (const item of crudos) {
    if (!ES_CAPITULO.test(item.href)) continue;
    const absoluta = new URL(item.href, 'https://www.webnovel.com').href;
    if (vistos.has(absoluta)) continue;
    vistos.add(absoluta);
    entradas.push({ texto: item.texto, url: absoluta, dePago: !!item.candado });
  }

  const capitulos = ordenarIndice(entradas);

  if (capitulos.length === 0) {
    throw new Error('No se pudo leer el índice de esta novela. ¿Sigue publicada?');
  }

  const libres = capitulos.filter(c => !c.dePago).length;
  avisar(`${capitulos.length} capítulos · ${libres} se pueden leer gratis`, 'done');

  return {
    title: ficha.titulo || 'Novela sin título',
    author: limpiarAutor(ficha.autor),
    synopsis: ficha.sinopsis || '',
    url: libro,
    source: 'Webnovel',

    completa: completaDelTitulo(ficha.titulo),

    coverUrl: `https://book-pic.webnovel.com/bookcover/${idDeLibro(libro)}`,
    totalChapters: capitulos.length,

    chapters: capitulos,
    series: Array.isArray(ficha.series) ? ficha.series : series,

    capitulosLibres: libres,
    capitulosDePago: capitulos.length - libres
  };
}

async function downloadChapters(chapters, fanficId, onProgress, saveContentFn, desde = 0) {
  if (!Array.isArray(chapters) || chapters.length === 0) return;

  let guardados = 0;
  let saltados = 0;
  let yaEstaban = 0;

  for (let i = 0; i < chapters.length; i++) {
    const cap = chapters[i];
    const numero = desde + i + 1;

    if (cap.yaEnDisco) { yaEstaban++; continue; }

    if (cap.dePago) { saltados++; continue; }

    if (onProgress) {
      onProgress({
        step: 'downloading_chapters',
        message: `Capítulo ${numero} de ${desde + chapters.length}…`,
        details: cap.title || ''
      });
    }

    let r;
    try {
      r = await mirar(cap.url, CAPITULO);
    } catch (err) {
      console.error(`[Webnovel] capítulo ${numero}: ${err.message}`);
      continue;
    }

    if (!r.texto || r.texto.trim().length < 40) {
      saltados++;
      continue;
    }

    if (await saveContentFn(fanficId, i, r.html || `<p>${r.texto}</p>`) !== false) guardados++;

    await dormir(1200);
  }

  if (guardados === 0 && yaEstaban > 0) {
    console.log(`[Webnovel] nada pendiente: ${yaEstaban} ya en disco · ${saltados} de pago.`);
    return;
  }

  if (guardados === 0) {
    throw new Error(saltados > 0
      ? `Los ${saltados} capítulos de este tramo son de pago en Webnovel`
      : 'No se pudo bajar ningún capítulo de Webnovel');
  }
  if (saltados > 0 || yaEstaban > 0) {
    console.log(`[Webnovel] ${guardados} guardados · ${saltados} de pago · ${yaEstaban} ya estaban.`);
  }
}

module.exports = {
  scrape,
  downloadChapters,
  idDeLibro,
  urlDeLibro,
  ES_CAPITULO,

  admiteHuecos: true
};
