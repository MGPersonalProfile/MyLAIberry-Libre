const { BrowserWindow } = require('electron');
const { parseMeta, portadaGrande } = require('./ffn.js');
const { cargarPagina, exigirQueNoSeaUnReto, muestraDePagina, PACIENCIA } = require('./navegar.js');

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function urlDeBusqueda({ consulta, orden = 'kudos_count', pagina = 1 }) {
  const EQUIVALENCIA = {
    kudos_count: '2',
    hits: '3',
    revised_at: '1',
    word_count: '4'
  };
  const p = new URLSearchParams();
  p.set('keywords', String(consulta || ''));
  p.set('ready', '1');
  p.set('type', 'story');
  p.set('sort', EQUIVALENCIA[orden] || '2');
  if (pagina > 1) p.set('ppage', String(pagina));
  return `https://www.fanfiction.net/search/?${p.toString()}`;
}

const LECTOR = [
  PACIENCIA,
  'new Promise(function (resolve) {',
  '  var intentos = 0;',
  '  var timer = setInterval(function () {',
  '    if (!mlSigueCargando()) intentos++;',
  '    var filas = document.querySelectorAll("div.z-list");',
  '    if (filas.length > 0 || intentos > 15) {',
  '      clearInterval(timer);',
  '      var salida = [];',
  '      for (var i = 0; i < filas.length; i++) {',
  '        var f = filas[i];',
  '        var a = f.querySelector("a.stitle") || f.querySelector("a[href^=\'/s/\']");',
  '        if (!a) continue;',
  '        var img = f.querySelector("img");',
  '        var gris = f.querySelector("div.xgray") || f.querySelector("div.z-padtop2");',
  '        var bloque = f.querySelector("div.z-indent") || f;',
  '        var autor = null;',
  '        var enlaces = f.querySelectorAll("a[href^=\'/u/\']");',
  '        if (enlaces.length) autor = enlaces[0];',
  '        salida.push({',
  '          href: a.getAttribute("href") || "",',
  '          titulo: (a.textContent || "").split(/\\s+/).join(" ").trim(),',
  '          autor: autor ? (autor.textContent || "").trim() : "",',
  '          autorHref: autor ? (autor.getAttribute("href") || "") : "",',
  '          portada: img ? (img.getAttribute("data-original") || img.getAttribute("src") || "") : "",',
  '          metaCrudo: gris ? (gris.textContent || "").trim() : "",',
  '          bloque: (bloque.textContent || "").split(/\\s+/).join(" ").trim()',
  '        });',
  '      }',
  '      resolve(salida);',
  '    }',
  '  }, 400);',
  '});'
].join('\n');

async function buscar({ consulta, orden, pagina }) {
  if (!String(consulta || '').trim()) return [];

  const win = new BrowserWindow({
    width: 1200, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let crudos = [];
  try {
    await cargarPagina(win, urlDeBusqueda({ consulta, orden, pagina }));
    await dormir(3000);
    crudos = await win.webContents.executeJavaScript(LECTOR);
    if (!crudos.length) exigirQueNoSeaUnReto('FanFiction.net', await muestraDePagina(win));
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }

  return parsearCrudos(crudos, orden, consulta);
}

function parsearCrudos(crudos, orden, consulta) {
  const obras = [];
  for (const r of crudos) {
    const m = String(r.href).match(/\/s\/(\d+)/);
    if (!m) continue;

    const meta = parseMeta(r.metaCrudo);

    let sinopsis = r.bloque || '';
    if (r.metaCrudo && sinopsis.endsWith(r.metaCrudo.replace(/\s+/g, ' ').trim())) {
      sinopsis = sinopsis.slice(0, sinopsis.length - r.metaCrudo.replace(/\s+/g, ' ').trim().length).trim();
    }

    const tags = meta.tags || [];

    obras.push({
      idOrigen: m[1],
      title: r.titulo || 'Obra sin título',
      synopsis: sinopsis,
      url: `https://www.fanfiction.net/s/${m[1]}/1`,
      source: 'FanFiction.net',
      author: r.autor || '',
      autorUrl: r.autorHref ? `https://www.fanfiction.net${r.autorHref}` : '',
      coverUrl: r.portada ? portadaGrande(r.portada) : '',
      wordCount: meta.words || 0,
      kudos: meta.favs || 0,

      completa: !!meta.completa || /[-·]\s*Complete\s*$/i.test(String(r.metaCrudo || '').trim()),
      tags,
      ...(typeof meta.crossover === 'boolean' ? { crossover: meta.crossover } : {}),
      totalChapters: meta.chapters || 1,
      chapterList: []
    });
  }

  return ordenar(obras, orden, consulta);
}

function ordenar(obras, orden = 'kudos_count', consulta = '') {
  const normal = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const buscada = normal(consulta);
  const parecido = (o) => (normal(o.title) === buscada ? 2 : normal(o.title).includes(buscada) ? 1 : 0);
  const porFavoritos = (a, b) => (b.kudos || 0) - (a.kudos || 0);
  const criterios = {
    kudos_count: porFavoritos,
    word_count: (a, b) => (b.wordCount || 0) - (a.wordCount || 0),
    _score: (a, b) => parecido(b) - parecido(a) || porFavoritos(a, b)
  };
  const criterio = criterios[orden];
  return criterio ? [...obras].sort(criterio) : obras;
}

module.exports = { buscar, urlDeBusqueda, ordenar, LECTOR, parsearCrudos };
