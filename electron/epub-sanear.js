const { normalizarTexto, normalizarAtributo } = require('./epub-xml');

const VACIOS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr'
]);

const DESCARTAR_ENTERO = new Set([
  'script', 'style', 'noscript', 'iframe', 'object', 'embed', 'video',
  'audio', 'canvas', 'svg', 'math', 'form', 'select', 'textarea', 'button',
  'template', 'head', 'title', 'link', 'meta', 'base', 'input', 'map', 'area'
]);

const PERMITIDOS = new Set([
  'p', 'div', 'span', 'br', 'hr', 'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'em', 'strong', 'i', 'b', 'u', 's', 'small', 'sub', 'sup', 'mark',
  'code', 'kbd', 'samp', 'var', 'pre', 'blockquote', 'q', 'cite', 'abbr',
  'del', 'ins', 'time', 'bdi', 'bdo', 'ruby', 'rt', 'rp', 'wbr', 'address',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'colgroup', 'col',
  'section', 'article', 'aside', 'header', 'footer', 'figure', 'figcaption',
  'details', 'summary', 'hgroup'
]);

const RENOMBRAR = {
  center: 'div', font: 'span', big: 'span', tt: 'code', strike: 's',
  acronym: 'abbr', nobr: 'span', main: 'div', nav: 'div', menu: 'ul',
  dir: 'ul', plaintext: 'pre', xmp: 'pre'
};

const ATRIBUTOS_GLOBALES = new Set(['id', 'class', 'title', 'lang', 'dir', 'hidden']);

const ATRIBUTOS_PROPIOS = {
  a: ['href'],
  img: ['src', 'alt'],
  td: ['colspan', 'rowspan', 'headers'],
  th: ['colspan', 'rowspan', 'headers', 'scope'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  time: ['datetime'],
  q: ['cite'],
  blockquote: ['cite'],
  del: ['cite', 'datetime'],
  ins: ['cite', 'datetime'],
  col: ['span'],
  colgroup: ['span'],
  bdo: ['dir']
};

const DE_BLOQUE = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl',
  'dt', 'dd', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr',
  'td', 'th', 'caption', 'hr', 'section', 'article', 'aside', 'header',
  'footer', 'figure', 'figcaption', 'address', 'details', 'summary'
]);

const RE_NOMBRE_APERTURA = /<([a-zA-Z][a-zA-Z0-9:._-]*)/y;
const RE_CIERRE = /<\/\s*([a-zA-Z][a-zA-Z0-9:._-]*)[^>]*>/y;
const RE_ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;

function normalizarId(valor) {
  const limpio = String(valor).trim().replace(/\s+/g, '-');
  if (!limpio) return '';
  return /^[A-Za-z_]/.test(limpio) ? limpio : 'id-' + limpio;
}

function buscarAbierto(pila, nombres, barreras) {
  for (let k = pila.length - 1; k >= 0; k--) {
    if (nombres.has(pila[k])) return k;
    if (barreras && barreras.has(pila[k])) return -1;
  }
  return -1;
}

const SOLO_P = new Set(['p']);
const BARRERAS_P = new Set([
  'div', 'blockquote', 'li', 'td', 'th', 'section', 'article', 'aside',
  'header', 'footer', 'figure', 'details', 'table', 'dd', 'dt', 'pre'
]);
const SOLO_LI = new Set(['li']);
const BARRERAS_LI = new Set(['ul', 'ol']);
const DT_DD = new Set(['dt', 'dd']);
const BARRERAS_DL = new Set(['dl']);
const SOLO_TR = new Set(['tr']);
const BARRERAS_TR = new Set(['table', 'thead', 'tbody', 'tfoot']);
const TD_TH = new Set(['td', 'th']);
const BARRERAS_TD = new Set(['tr']);

const PROFUNDIDAD_MAXIMA = 60;

function cuerpoDe(html) {
  const fuente = String(html == null ? '' : html);
  const cuerpo = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(fuente);
  return cuerpo ? cuerpo[1] : fuente;
}

function saltarNoEtiqueta(fuente, lt) {
  const n = fuente.length;
  if (fuente.startsWith('<!--', lt)) {
    const fin = fuente.indexOf('-->', lt + 4);
    return { i: fin < 0 ? n : fin + 3 };
  }
  if (/^<!\[CDATA\[/i.test(fuente.substr(lt, 9))) {
    const fin = fuente.indexOf(']]>', lt + 9);
    return { i: fin < 0 ? n : fin + 3, texto: fuente.slice(lt + 9, fin < 0 ? n : fin) };
  }
  const fin = fuente.indexOf('>', lt);
  return { i: fin < 0 ? n : fin + 1 };
}

function finDeEtiqueta(fuente, desde) {
  let comilla = null;
  for (let j = desde; j < fuente.length; j++) {
    const ch = fuente[j];
    if (comilla) { if (ch === comilla) comilla = null; }
    else if (ch === '"' || ch === "'") comilla = ch;
    else if (ch === '>') return j;
  }
  return fuente.length;
}

function saltarContenido(fuente, desde, nombre) {
  const re = new RegExp('<(/?)' + nombre + '\\b', 'gi');
  re.lastIndex = desde;
  let nivel = 1;
  let p;
  while ((p = re.exec(fuente))) {
    nivel += p[1] ? -1 : 1;
    if (nivel === 0) {
      const cierre = fuente.indexOf('>', p.index);
      return cierre < 0 ? fuente.length : cierre + 1;
    }
  }
  return fuente.length;
}

function* piezas(fuente) {
  const n = fuente.length;
  let i = 0;

  while (i < n) {
    const lt = fuente.indexOf('<', i);
    if (lt < 0) { yield { tipo: 'texto', texto: fuente.slice(i) }; break; }
    if (lt > i) yield { tipo: 'texto', texto: fuente.slice(i, lt) };

    const siguiente = fuente[lt + 1];

    if (siguiente === '!' || siguiente === '?') {
      const salto = saltarNoEtiqueta(fuente, lt);
      if (salto.texto !== undefined) yield { tipo: 'texto', texto: salto.texto };
      i = salto.i;
      continue;
    }

    if (siguiente === '/') {
      RE_CIERRE.lastIndex = lt;
      const m = RE_CIERRE.exec(fuente);
      if (!m) { yield { tipo: 'crudo', texto: '&lt;' }; i = lt + 1; continue; }
      i = RE_CIERRE.lastIndex;
      yield { tipo: 'cierre', nombre: m[1].toLowerCase() };
      continue;
    }

    RE_NOMBRE_APERTURA.lastIndex = lt;
    const m = RE_NOMBRE_APERTURA.exec(fuente);
    if (!m) { yield { tipo: 'crudo', texto: '&lt;' }; i = lt + 1; continue; }

    const desdeAtributos = RE_NOMBRE_APERTURA.lastIndex;
    const j = finDeEtiqueta(fuente, desdeAtributos);
    const crudo = fuente.slice(desdeAtributos, j);
    const autocerrada = /\/\s*$/.test(crudo);
    i = j < n ? j + 1 : n;

    const nombre = m[1].toLowerCase();
    if (DESCARTAR_ENTERO.has(nombre)) {
      if (!VACIOS.has(nombre) && !autocerrada) i = saltarContenido(fuente, i, nombre);
      continue;
    }

    yield { tipo: 'apertura', nombre, crudo, autocerrada };
  }
}

function atributosDe(crudo, nombre) {
  const atributos = [];
  const propios = ATRIBUTOS_PROPIOS[nombre] || [];
  let fuenteImagen = null;

  RE_ATRIBUTO.lastIndex = 0;
  let a;
  while ((a = RE_ATRIBUTO.exec(crudo))) {
    const clave = a[1].toLowerCase();
    if (clave === '/' || clave === '') continue;
    if (!ATRIBUTOS_GLOBALES.has(clave) && !propios.includes(clave)) continue;

    let valor = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4];
    if (valor === undefined) valor = clave;

    if (clave === 'id') {
      valor = normalizarId(valor);
      if (!valor) continue;
    }
    if (clave === 'dir' && !/^(ltr|rtl|auto)$/i.test(valor)) continue;
    if (clave === 'href') {
      const destino = valor.trim();

      if (/^(javascript|data|vbscript):/i.test(destino)) continue;
      valor = destino.startsWith('#') ? '#' + normalizarId(destino.slice(1)) : destino;
    }
    if (clave === 'src') fuenteImagen = valor.trim();

    atributos.push(' ' + clave + '="' + normalizarAtributo(valor) + '"');
  }

  return { atributos, fuenteImagen };
}

function imagenValida(fuenteImagen, imagenesRemotas) {
  if (!fuenteImagen) return false;
  const local = !/^[a-z][a-z0-9+.-]*:\/\//i.test(fuenteImagen) && !/^\/\//.test(fuenteImagen);
  return local || imagenesRemotas;
}

function cerrarImplicitos(nombre, pila, cerrarHasta) {
  const cerrar = (nombres, barreras) => {
    const abierto = buscarAbierto(pila, nombres, barreras);
    if (abierto >= 0) cerrarHasta(abierto);
  };

  if (DE_BLOQUE.has(nombre)) cerrar(SOLO_P, BARRERAS_P);
  if (nombre === 'li') cerrar(SOLO_LI, BARRERAS_LI);
  if (nombre === 'dt' || nombre === 'dd') cerrar(DT_DD, BARRERAS_DL);
  if (nombre === 'tr') cerrar(SOLO_TR, BARRERAS_TR);
  if (nombre === 'td' || nombre === 'th') cerrar(TD_TH, BARRERAS_TD);
}

function sanearHtml(html, opciones = {}) {
  const imagenesRemotas = opciones.imagenesRemotas === true;
  const salida = [];
  const pila = [];

  const cerrarHasta = (indice) => {
    while (pila.length > indice) salida.push('</' + pila.pop() + '>');
  };

  for (const pieza of piezas(cuerpoDe(html))) {
    if (pieza.tipo === 'texto') { salida.push(normalizarTexto(pieza.texto)); continue; }
    if (pieza.tipo === 'crudo') { salida.push(pieza.texto); continue; }

    const nombre = RENOMBRAR[pieza.nombre] || pieza.nombre;

    if (pieza.tipo === 'cierre') {
      if (VACIOS.has(nombre) || !PERMITIDOS.has(nombre)) continue;

      const donde = buscarAbierto(pila, new Set([nombre]), null);
      if (donde >= 0) cerrarHasta(donde);
      continue;
    }

    if (!PERMITIDOS.has(nombre)) continue;

    const { atributos, fuenteImagen } = atributosDe(pieza.crudo, nombre);
    if (nombre === 'img' && !imagenValida(fuenteImagen, imagenesRemotas)) continue;

    if (VACIOS.has(nombre) || pieza.autocerrada) {
      if (DE_BLOQUE.has(nombre)) {
        const abierto = buscarAbierto(pila, SOLO_P, BARRERAS_P);
        if (abierto >= 0) cerrarHasta(abierto);
      }
      salida.push('<' + nombre + atributos.join('') + '/>');
      continue;
    }

    cerrarImplicitos(nombre, pila, cerrarHasta);

    if (pila.length >= PROFUNDIDAD_MAXIMA) continue;

    salida.push('<' + nombre + atributos.join('') + '>');
    pila.push(nombre);
  }

  cerrarHasta(0);
  return salida.join('');
}

module.exports = { sanearHtml };
