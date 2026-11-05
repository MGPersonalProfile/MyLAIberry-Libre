const { BrowserWindow } = require('electron');
const { FANDOM, GENERO } = require('../etiquetas.js');
const { cargarPagina, exigirQueNoSeaUnReto, muestraDePagina, PACIENCIA } = require('./navegar.js');

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function urlDeBusqueda({ consulta, orden = 'kudos_count', pagina = 1 }) {
  const EQUIVALENCIA = {
    kudos_count: 'followers',
    hits: 'views',
    revised_at: 'last_update',
    word_count: 'length',
    relevance: 'relevance',
    _score: 'relevance'
  };
  const p = new URLSearchParams();
  p.set('title', String(consulta || ''));
  p.set('orderBy', EQUIVALENCIA[orden] || 'relevance');
  if (pagina > 1) p.set('page', String(pagina));
  return `https://www.royalroad.com/fictions/search?${p.toString()}`;
}

const LECTOR = [
  PACIENCIA,
  'new Promise(function (resolve) {',
  '  var intentos = 0;',
  '  var timer = setInterval(function () {',
  '    if (!mlSigueCargando()) intentos++;',
  '    var filas = document.querySelectorAll(".fiction-list-item");',
  '    if (filas.length > 0 || intentos > 15) {',
  '      clearInterval(timer);',
  '      var salida = [];',
  '      var limpio = function (el) {',
  '        return el ? (el.textContent || "").split(/\\s+/).join(" ").trim() : "";',
  '      };',
  '      for (var i = 0; i < filas.length; i++) {',
  '        var f = filas[i];',
  '        // El titulo: el enlace rojo en negrita. El de la portada va vacio.',
  '        var a = f.querySelector("a.font-red-sunglo") || f.querySelector("h2 a");',
  '        if (!a) continue;',
  '        var img = f.querySelector("img");',
  '',
  '        var etiquetas = [];',
  '        var tags = f.querySelectorAll("a.label");',
  '        for (var j = 0; j < tags.length; j++) {',
  '          var t = limpio(tags[j]);',
  '          if (t) etiquetas.push(t);',
  '        }',
  '',
  '        // Cada cifra en su columna: "33,071 Followers", "109 Chapters"...',
  '        var stats = [];',
  '        var cols = f.querySelectorAll(".stats .col-sm-6, .row.stats div");',
  '        for (var k = 0; k < cols.length; k++) {',
  '          var s = limpio(cols[k]);',
  '          if (s && s.length < 40) stats.push(s);',
  '        }',
  '',
  '        // La sinopsis es el ultimo bloque de texto largo de la fila.',
  '        var sinopsis = "";',
  '        var posibles = f.querySelectorAll("div.margin-top-10, .fiction-description, .description");',
  '        for (var n = 0; n < posibles.length; n++) {',
  '          var p = limpio(posibles[n]);',
  '          if (p.length > sinopsis.length) sinopsis = p;',
  '        }',
  '',
  '        salida.push({',
  '          href: a.getAttribute("href") || "",',
  '          titulo: limpio(a),',
  '          sinopsis: sinopsis,',
  '          portada: img ? (img.getAttribute("src") || "") : "",',
  '          etiquetas: etiquetas,',
  '          stats: stats,',
  '          // "COMPLETED" aparece como texto suelto en la cabecera de la fila.',
  '          completa: limpio(f).indexOf("COMPLETED") >= 0',
  '        });',
  '      }',
  '      resolve(salida);',
  '    }',
  '  }, 400);',
  '});'
].join('\n');

const { numero, dato: datoEtiquetado } = require('./numeros.js');

async function buscar({ consulta, orden, pagina, url }) {
  if (!url && !String(consulta || '').trim()) return [];

  const win = new BrowserWindow({
    width: 1200, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let crudos = [];
  try {
    await cargarPagina(win, url || urlDeBusqueda({ consulta, orden, pagina }));
    await dormir(2500);
    crudos = await win.webContents.executeJavaScript(LECTOR);
    if (!crudos.length) exigirQueNoSeaUnReto('RoyalRoad', await muestraDePagina(win));
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }

  return parsearCrudos(crudos);
}

function parsearCrudos(crudos) {
  const obras = [];
  for (const r of crudos) {
    const m = String(r.href).match(/\/fiction\/(\d+)/);
    if (!m) continue;

    const stats = (r.stats || []).join(' · ');
    const dato = (etiqueta) => datoEtiquetado(etiqueta, stats);

    obras.push({
      idOrigen: m[1],
      title: r.titulo || 'Obra sin título',
      synopsis: r.sinopsis || '',
      url: `https://www.royalroad.com/fiction/${m[1]}`,
      source: 'RoyalRoad',
      author: '',
      coverUrl: r.portada || '',
      wordCount: dato('pages') * 275 || 0,
      kudos: dato('followers'),

      tags: (r.etiquetas || [])
        .filter(t => t && t.length < 40)
        .slice(0, 12)
        .map(t => ({ name: t, category: GENERO })),
      completa: !!r.completa,

      totalChapters: dato('chapters'),
      chapterList: []
    });
  }

  void FANDOM;

  return obras;
}

module.exports = { buscar, urlDeBusqueda, LECTOR, parsearCrudos };
