const { textoPlano } = require('../capitulo-valido.js');

const MIN_VINHETAS = 5;
const MAX_TEXTO_DE_COMIC = 3000;
const SEGUIDOS = 3;

function pareceCapituloDeComic({ imagenesGrandes = 0, texto = 0 }) {
  return imagenesGrandes >= MIN_VINHETAS && texto < MAX_TEXTO_DE_COMIC;
}

function largoEfectivo(texto = '') {
  const cjk = (texto.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g) || []).length;
  return texto.length + cjk * 2;
}

function imagenesGrandesDelContenido() {
  var fuera = 'header, nav, aside, footer, [class*="related"], [class*="sidebar"], [id*="sidebar"], [class*="comment"], #comments';
  function contar(raiz) {
    var n = 0, imgs = raiz.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
      var i = imgs[k];
      if (i.closest(fuera)) continue;
      var r = i.getBoundingClientRect();
      if (i.naturalWidth >= 500 && i.naturalHeight >= 500 && r.width >= 300 && r.height >= 300) n++;
    }
    return n;
  }
  var candidatos = Array.prototype.slice.call(
    document.querySelectorAll('article, main, [role=main], #content, .entry-content, .chapter-content, #storytext')
  ).filter(function (e) { return !e.closest(fuera); });
  var raiz = null;
  if (candidatos.length) {
    var largo = function (e) { return ((e.innerText || e.textContent) || '').trim().length; };
    candidatos.sort(function (a, b) {
      var diff = largo(b) - largo(a);
      return diff !== 0 ? diff : contar(b) - contar(a);
    });
    raiz = candidatos[0];
  }
  return raiz ? contar(raiz) : contar(document.body);
}

const GUION_IMAGENES_GRANDES = `(${imagenesGrandesDelContenido.toString()})()`;

async function esPaginaDeComic(win, pagina) {
  const imagenesGrandes = await win.webContents.executeJavaScript(GUION_IMAGENES_GRANDES).catch(() => 0);
  return pareceCapituloDeComic({ imagenesGrandes, texto: largoEfectivo(textoPlano(pagina?.content)) });
}

function errorDeComic(url) {
  let host = 'Este sitio'; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {  }
  return Object.assign(new Error(`${host} publica sus capítulos como imágenes (es un cómic) y MyLAIberry no tiene fuente para él: ` +
    'sólo importa cómics de Webtoon, Flame Comics, MangaDex y Asura Scans.'), { noSoportado: true });
}

async function comprobarObraNoEsComic(win, candidatos, leer) {
  const muestra = candidatos.slice(0, SEGUIDOS);
  if (muestra.length < SEGUIDOS) return;
  for (const c of muestra) {
    if (!await esPaginaDeComic(win, await leer(c.url))) return;
  }
  throw errorDeComic(muestra[0].url);
}

function cuentaDeComics({ conTexto: inicial = false } = {}) {
  let seguidos = 0, conTexto = !!inicial;
  return {
    nota(esComic, url) {
      if (!esComic) conTexto = true;
      seguidos = esComic ? seguidos + 1 : 0;
      if (!conTexto && seguidos >= SEGUIDOS) throw errorDeComic(url);
    }
  };
}

module.exports = { pareceCapituloDeComic, largoEfectivo, imagenesGrandesDelContenido, esPaginaDeComic, errorDeComic,
  comprobarObraNoEsComic, cuentaDeComics };
