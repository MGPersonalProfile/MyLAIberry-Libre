const { BrowserWindow } = require('electron');
const { JSDOM } = require('jsdom');
const { cargarPagina, PACIENCIA, mientrasAvance, ejecutarAunqueNavegue } = require('./navegar.js');
const { numero } = require('./numeros.js');

const LECTOR_PERFIL = [
  PACIENCIA,
  'new Promise(function (resolve) {',
  '  var intentos = 0;',
  '  var timer = setInterval(function () {',
  '    if (!mlSigueCargando()) intentos++;',
  '    var contenedor = document.querySelector(".portlet-body") || document.querySelector(".profile-content");',
  '    var aviso = (document.title || "") + " " + (document.body ? document.body.innerText : "");',
  '    var tarjetas = document.querySelectorAll(".mt-element-overlay");',

  '    var noExiste = !tarjetas.length && aviso.indexOf("Not Found") >= 0;',
  '    var listo = !!(tarjetas.length > 0 || noExiste || (contenedor && intentos > 5));',
  '    if (listo || intentos > 20) {',
  '      clearInterval(timer);',
  '      if (noExiste) {',
  '        resolve({ noExiste: true });',
  '        return;',
  '      }',
  '      var nombre = "";',
  '      var h1 = document.querySelector("h1");',
  '      if (h1) nombre = (h1.innerText || "").trim();',
  '      if (!nombre) {',
  '        var uTitle = document.querySelector(".profile-usertitle-name");',
  '        if (uTitle) nombre = (uTitle.innerText || "").trim();',
  '      }',
  '      var paginador = document.querySelector("ul.pagination, .pagination");',
  '      var hasNext = false;',
  '      if (paginador) {',
  '        var activa = paginador.querySelector("li.page-active, li.active");',
  '        if (activa && activa.nextElementSibling) {',
  '          var sigA = activa.nextElementSibling.querySelector("a");',
  '          if (sigA && sigA.getAttribute("href")) {',
  '            var txt = (sigA.innerText || "").trim();',
  '            if (txt.indexOf("First") < 0) hasNext = true;',
  '          }',
  '        }',
  '      }',
  '      resolve({',
  '        listo: true,',
  '        nombre: nombre,',
  '        html: contenedor ? contenedor.innerHTML : document.body.innerHTML,',
  '        hasNext: hasNext',
  '      });',
  '    }',
  '  }, 400);',
  '});'
].join('\n');

function urlDeAutor(url) {
  const m = String(url || '').match(/\/profile\/(\d+)/);
  return m ? `https://www.royalroad.com/profile/${m[1]}` : '';
}

function parsearEstadisticas(smalls) {

  let completa;
  let capitulos = 0;
  let paginas = 0;

  for (const s of smalls || []) {
    if (/completed/i.test(s)) completa = true;
    else if (completa === undefined && /\b(ongoing|hiatus|stub|inactive|dropped)\b/i.test(s)) completa = false;
    const mCap = s.match(/([\d,.]+k?)\s*(?:chapters?|cap\b|capítulos?)/i);
    if (mCap) capitulos = numero(mCap[1]) || 0;
    const mPag = s.match(/([\d,.]+k?)\s*pages?/i);
    if (mPag) paginas = numero(mPag[1]) || 0;
  }

  return { completa, capitulos, paginas };
}

function obraDeTarjeta(t, { autor = '', autorUrl = '' } = {}) {
  const img = t.querySelector('img.cover');
  const h2 = t.querySelector('h2');

  const btn = t.querySelector('.mt-info > a.btn')
    || t.querySelector('a.btn')
    || t.querySelector('a[href*="/fiction/"]');

  const href = btn ? (btn.getAttribute('href') || '') : '';
  const idMatch = href.match(/\/fiction\/(\d+)/) || (img?.id || '').match(/cover-(\d+)/);
  if (!idMatch) return null;
  const idOrigen = idMatch[1];

  const title = (img?.getAttribute('alt') || h2?.childNodes[0]?.textContent || 'Obra sin título').trim();
  const descEl = t.querySelector('.fiction-description');
  const synopsis = descEl ? descEl.textContent.trim() : '';

  let coverUrl = img ? (img.getAttribute('src') || img.src || '') : '';
  if (coverUrl && /nocover/i.test(coverUrl)) coverUrl = '';
  if (coverUrl && coverUrl.startsWith('/')) coverUrl = `https://www.royalroad.com${coverUrl}`;

  const smalls = Array.from(t.querySelectorAll('h2 small')).map(s => s.textContent.trim());
  const { completa, capitulos, paginas } = parsearEstadisticas(smalls);

  return {
    idOrigen,
    title,
    synopsis,
    url: `https://www.royalroad.com/fiction/${idOrigen}`,
    source: 'RoyalRoad',
    author: autor,
    autorUrl,
    ...(coverUrl ? { coverUrl } : {}),
    wordCount: paginas ? Math.round(paginas * 275) : 0,
    kudos: 0,
    tags: [],
    ...(completa !== undefined ? { completa } : {}),
    totalChapters: capitulos || 0,
    chapterList: []
  };
}

function trocearPerfil(html, { autor = '', autorUrl = '' } = {}) {
  const doc = new JSDOM(html).window.document;
  const nombreAutor = autor
    || doc.querySelector('h1')?.textContent?.trim()
    || doc.querySelector('.profile-usertitle-name')?.textContent?.trim()
    || 'Autor desconocido';

  const tarjetas = doc.querySelectorAll('.mt-element-overlay');
  const obras = [];

  for (const t of tarjetas) {
    const obra = obraDeTarjeta(t, { autor: nombreAutor, autorUrl });
    if (obra) obras.push(obra);
  }

  return obras;
}

async function leerAutor(autorUrl) {
  const canonica = urlDeAutor(autorUrl);
  const m = canonica.match(/\/profile\/(\d+)/);
  if (!m) throw new Error('URL de autor de RoyalRoad no válida');
  const autorId = m[1];

  const win = new BrowserWindow({
    width: 1200, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const todasLasObras = [];
  let nombreFinal = '';

  try {
    for (let pagina = 1; ; pagina++) {
      const url = pagina === 1
        ? `https://www.royalroad.com/profile/${autorId}/fictions`
        : `https://www.royalroad.com/profile/${autorId}/fictions?page=${pagina}`;

      const r = await mientrasAvance(win, cargarPagina(win, url)
        .then(() => ejecutarAunqueNavegue(win, LECTOR_PERFIL)), 'RoyalRoad, perfil del autor');
      if (r.error) throw new Error(r.error);
      if (r.noExiste) {
        throw Object.assign(new Error('RoyalRoad dice que este autor no existe o ya no está disponible'), { noExiste: true });
      }

      if (r.nombre && !nombreFinal) nombreFinal = r.nombre;

      const obrasDePagina = trocearPerfil(r.html, {
        autor: nombreFinal || r.nombre,
        autorUrl: canonica
      });

      if (obrasDePagina.length === 0) break;

      const conocidas = new Set(todasLasObras.map(o => o.idOrigen));
      const nuevas = obrasDePagina.filter(o => !conocidas.has(o.idOrigen));
      if (nuevas.length === 0) break;

      todasLasObras.push(...nuevas);

      if (!r.hasNext) break;
    }

    return {
      nombre: nombreFinal || 'Autor',
      obras: todasLasObras
    };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = {
  leerAutor,
  LECTOR_PERFIL,
  urlDeAutor,
  trocearPerfil,
  parsearEstadisticas
};
