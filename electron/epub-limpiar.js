const ESQUEMA = /^[a-z][a-z0-9+.-]*:/i;
const BLOQUES = new Set(['DIV', 'P', 'FIGURE', 'SPAN', 'A', 'CENTER', 'SECTION']);

const normal = (t) => String(t || '').replace(/\s+/g, ' ').trim();

const esInterno = (v) => !!v && !ESQUEMA.test(v.trim());

const SELECTOR_BOILERPLATE = '#pg-header, #pg-footer, .pg-boilerplate, header.pgheader, footer.pgfooter, #pg-start-separator, #pg-end-separator';
const INICIO = /^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i;
const FINAL = /^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i;

function elementoDeMarca(cuerpo, marca) {

  const paseo = cuerpo.ownerDocument.createTreeWalker(cuerpo, 4);
  for (let n = paseo.nextNode(); n; n = paseo.nextNode()) {
    if (marca.test(normal(n.data))) return n.parentElement;
  }
  return null;
}

function quitarHastaElCuerpo(nodo, cuerpo, antes) {

  for (let n = nodo; n && n !== cuerpo; n = n.parentNode) {
    let h = antes ? n.previousSibling : n.nextSibling;
    while (h) { const sig = antes ? h.previousSibling : h.nextSibling; h.remove(); h = sig; }
  }
  nodo.remove();
}

function quitarGutenberg(doc) {
  const cuerpo = doc.querySelector('body');
  if (!cuerpo) return false;
  let habia = false;
  for (const el of [...cuerpo.querySelectorAll(SELECTOR_BOILERPLATE)]) { el.remove(); habia = true; }

  const inicio = elementoDeMarca(cuerpo, INICIO);
  if (inicio) { quitarHastaElCuerpo(inicio, cuerpo, true); habia = true; }
  const final = elementoDeMarca(cuerpo, FINAL);
  if (final) { quitarHastaElCuerpo(final, cuerpo, false); habia = true; }
  return habia;
}

function desenlazar(doc, a) {
  const nuevo = doc.createElement('span');
  if (a.id) nuevo.id = a.id;
  while (a.firstChild) nuevo.appendChild(a.firstChild);
  a.replaceWith(nuevo);
}

function quitarVacios(el) {
  let padre = el.parentElement;
  el.remove();
  while (padre && BLOQUES.has(padre.tagName) && !padre.id && !normal(padre.textContent) && !padre.querySelector('img, svg, audio, video')) {
    const arriba = padre.parentElement;
    padre.remove();
    padre = arriba;
  }
}

function quitarImagen(doc, img) {
  const alt = normal(img.getAttribute('alt'));
  const contexto = img.closest('figure, div, p') || img.parentElement;
  const yaDicho = !contexto || normal(contexto.textContent).toLowerCase().includes(alt.toLowerCase());
  if (alt.length >= 4 && !yaDicho) {
    const em = doc.createElement('em');
    em.textContent = alt;
    const p = doc.createElement('p');
    p.appendChild(em);
    img.replaceWith(p);
    return;
  }
  quitarVacios(img);
}

function limpiarEnlacesEImagenes(doc) {
  const cuerpo = doc.querySelector('body');
  if (!cuerpo) return;
  for (const img of [...cuerpo.querySelectorAll('img')]) {
    if (esInterno(img.getAttribute('src'))) quitarImagen(doc, img);
  }
  for (const s of [...cuerpo.querySelectorAll('svg')]) {
    const dentro = s.querySelector('image');
    if (dentro && esInterno(dentro.getAttribute('href') || dentro.getAttribute('xlink:href'))) quitarVacios(s);
  }
  for (const a of [...cuerpo.querySelectorAll('a[href]')]) {
    if (esInterno(a.getAttribute('href'))) desenlazar(doc, a);
  }
  for (const m of [...cuerpo.querySelectorAll('[role="doc-pagebreak"], .x-ebookmaker-pageno')]) {
    if (!normal(m.textContent)) m.remove();
  }
}

const PALABRA = '(chapter|cap[ií]tulo|chapitre|kapitel|capitolo)';
const CAPITULO = new RegExp(`^(?:(.*?)[\\s“”"’'.!?,;:]+)?${PALABRA}\\s*([ivxlcdm]+|\\d+)(\\.?)\\s*$`, 'i');
const ES_CAPITULO = new RegExp(`^${PALABRA}\\s*([ivxlcdm]+|\\d+)\\b`, 'i');

function tituloDeCapitulo(titulo) {
  const t = normal(titulo);
  const m = t.match(CAPITULO);
  if (!m) return t;
  const palabra = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  return `${palabra} ${m[3].toUpperCase()}${m[4]}`;
}

const ROMANO = /^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i;
const NUMERAL_SOLO = (t) => { const m = t.match(/^([ivxlcdm]+|\d+)\.?$/i); return !!m && (/^\d+$/.test(m[1]) || ROMANO.test(m[1])); };

const pareceCapitulo = (titulo) => ES_CAPITULO.test(normal(titulo)) || NUMERAL_SOLO(normal(titulo));

const ES_PROLOGO = /^(prologue|prolog|prólogo|proem|overture)\b/i;

function claveDeTitulo(titulo) {
  return tituloDeCapitulo(titulo).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const NO_ES_CAPITULO = /^(contents|table of contents|list of illustrations|illustrations?|index|title page|colou?phon|(the )?(full )?project gutenberg.{0,3}(tm|™)?\s*(license|literary))/i;

function podarGutenberg(todos) {
  const capitulos = todos.map(c => ({ ...c, title: tituloDeCapitulo(c.title) }));
  const primero = capitulos.findIndex(c => pareceCapitulo(c.title));
  const hay = capitulos.filter(c => pareceCapitulo(c.title)).length >= 2;
  return capitulos.filter((c, i) => !(hay && i < primero && !ES_PROLOGO.test(normal(c.title))) && !NO_ES_CAPITULO.test(normal(c.title)));
}

module.exports = {
  quitarGutenberg, limpiarEnlacesEImagenes, tituloDeCapitulo, claveDeTitulo, pareceCapitulo, podarGutenberg
};
