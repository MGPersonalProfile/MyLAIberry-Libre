const path = require('path');
const { lectorDeTexto, resolverRuta, lectoresJsdom } = require('./epub.js');

const MENSAJE = /Posted originally on the\s+(?:<[^>]+>\s*)*Archive of Our Own[\s\S]{0,400}?\/works\/\d+/i;

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const limpio = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

function ficherosDelSpine(texto, p) {
  const contenedor = p.xml(texto('META-INF/container.xml'));
  const rutaOpf = contenedor.querySelector('rootfile')?.getAttribute('full-path');
  if (!rutaOpf) return [];
  const opf = p.xml(texto(rutaOpf));
  const carpeta = path.posix.dirname(rutaOpf);
  const manifiesto = new Map();
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifiesto.set(item.getAttribute('id'), item);
  }
  const lista = [];
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    const item = manifiesto.get(ref.getAttribute('idref'));
    if (!item || !/xhtml|html/i.test(item.getAttribute('media-type') || '')) continue;
    lista.push(resolverRuta(carpeta, item.getAttribute('href')));
  }
  return lista;
}

const primerDiv = (doc) => doc.querySelector('body')?.firstElementChild || null;

function htmlDeEpubAo3(buffer) {
  const p = lectoresJsdom();
  try {
    const texto = lectorDeTexto(buffer);
    const ficheros = ficherosDelSpine(texto, p);
    if (!ficheros.length) return null;

    const primero = texto(ficheros[0]);
    const docPrimero = p.html(primero);
    if (primerDiv(docPrimero)?.id !== 'preface' || !MENSAJE.test(primero)) return null;

    let mensaje = '', h1 = '', byline = '', tags = null, resumen = '';
    const capitulos = [];
    for (let i = 0; i < ficheros.length; i++) {
      let html;
      try { html = i === 0 ? primero : texto(ficheros[i]); } catch (e) {
        if (e.sobreElTecho) throw e;
        continue;
      }
      const doc = i === 0 ? docPrimero : p.html(html);
      const cabeza = primerDiv(doc)?.id;
      if (cabeza === 'preface') {
        mensaje = mensaje || doc.querySelector('#preface .message')?.outerHTML || '';
        h1 = h1 || limpio(doc.querySelector('#preface h1'));
        byline = byline || doc.querySelector('#preface .byline')?.outerHTML || '';
        tags = tags || doc.querySelector('#preface dl.tags');

        resumen = resumen || doc.querySelector('#preface blockquote')?.innerHTML.trim() || '';

        capitulos.push(...capitulosDelFichero(doc));
        continue;
      }
      if (cabeza === 'afterword') continue;
      capitulos.push(...capitulosDelFichero(doc));
    }
    if (!h1 || !capitulos.length) return null;

    const dl = (tags ? tags.innerHTML : '')
      + (resumen ? `<dt>Summary:</dt><dd><div class="userstuff">${resumen}</div></dd>` : '');

    const cuerpo = capitulos.map(c => (c.titulo ? `<div class="meta group"><h2 class="heading">${escapar(c.titulo)}</h2></div>` : '')
      + `<div class="userstuff">${c.texto}</div>`).join('\n');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapar(h1)} - Archive of Our Own</title></head><body>`
      + `<div id="preface">${mensaje}<div class="meta"><h1>${escapar(h1)}</h1>${byline}<dl>${dl}</dl></div></div>`
      + `<div id="chapters" class="userstuff">${cuerpo}</div></body></html>`;
  } finally {
    p.cerrar();
  }
}

function capitulosDelFichero(doc) {
  const raiz = doc.querySelector('#chapters');
  if (!raiz) return [];
  const encabezado = raiz.querySelector('h2.heading');
  if (!encabezado) {
    const html = raiz.innerHTML.trim();
    return limpio(raiz) ? [{ titulo: '', texto: html }] : [];
  }
  let envoltorio = encabezado;
  while (envoltorio.parentElement && envoltorio.parentElement !== raiz) envoltorio = envoltorio.parentElement;
  let texto = envoltorio.nextElementSibling;
  while (texto && /^endnotes/.test(texto.id || '')) texto = texto.nextElementSibling;
  return [{ titulo: limpio(encabezado), texto: texto ? texto.innerHTML.trim() : '' }];
}

module.exports = { htmlDeEpubAo3 };
