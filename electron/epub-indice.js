const path = require('node:path');

function leerIndice(opf, carpeta, leer, p) {
  const indice = new Map();
  const items = [...opf.querySelectorAll('manifest > item')];
  const nav = items.find(i => (i.getAttribute('properties') || '').split(/\s+/).includes('nav'));
  const ncx = items.find(i => i.getAttribute('media-type') === 'application/x-dtbncx+xml');
  for (const item of [nav, ncx].filter(Boolean)) {
    try {
      const archivo = path.posix.normalize(path.posix.join(carpeta, decodeURIComponent(item.getAttribute('href'))));
      const doc = item === nav ? p.html(leer(archivo)) : p.xml(leer(archivo));
      const enlaces = item === nav ? [...(doc.querySelector('nav[epub\\:type="toc"], nav[role="doc-toc"], nav') || doc).querySelectorAll('a[href]')]
        : [...doc.querySelectorAll('navPoint')];
      for (const e of enlaces) {
        const href = item === nav ? e.getAttribute('href') : e.querySelector('content')?.getAttribute('src');

        const titulo = (item === nav ? e.textContent : e.querySelector('navLabel')?.textContent)?.replace(/\s+/g, ' ').trim();
        if (!href || !titulo || /^[a-z]+:/i.test(href)) continue;
        const [fichero, fragmento] = href.split('#');
        if (!fragmento) continue;

        let ruta, id;
        try {
          ruta = path.posix.normalize(path.posix.join(path.posix.dirname(archivo), decodeURIComponent(fichero)));
          id = decodeURIComponent(fragmento);
        } catch { continue; }
        const entradas = indice.get(ruta) || [];
        if (!entradas.some(x => x.id === id)) entradas.push({ id, titulo });
        indice.set(ruta, entradas);
      }
      if (indice.size) break;
    } catch (e) { if (e.sobreElTecho) throw e; }
  }
  return indice;
}

function buscarId(raiz, id) {
  const q = String(id).replace(/["\\]/g, '\\$&');
  return raiz.querySelector(`[id="${q}"]`) || raiz.querySelector(`a[name="${q}"]`);
}

function ordenar(puntos) {
  if (puntos.length < 2) return puntos;
  const raiz = puntos[0].nodo.ownerDocument.documentElement;
  const sitio = new Map();
  let i = 0;
  for (const el of [raiz, ...raiz.querySelectorAll('*')]) sitio.set(el, i++);
  return puntos.sort((a, b) => sitio.get(a.nodo) - sitio.get(b.nodo));
}

function separarAntes(nodo, raiz, caja) {
  let cadena = null;
  for (let a = nodo; a !== raiz; a = a.parentNode) {
    const padre = a.parentNode;
    let copia = caja;
    if (padre !== raiz) { copia = padre.cloneNode(false); copia.removeAttribute?.('id'); }
    while (a.previousSibling) copia.insertBefore(a.previousSibling, copia.firstChild);
    if (cadena && cadena.childNodes.length) copia.appendChild(cadena);
    cadena = copia;
  }
}

function cortar(doc, cuerpo, puntos, tituloReserva, minimoFrontal = 0) {
  const partes = [];
  const guardar = (caja, titulo, frontal) => {
    const largo = caja.textContent.trim().length;
    if (!largo || (frontal && largo < minimoFrontal)) return;
    partes.push({ title: titulo, content: caja.innerHTML });
  };
  for (let i = 0; i < puntos.length; i++) {
    const caja = doc.createElement('div');
    separarAntes(puntos[i].nodo, cuerpo, caja);
    guardar(caja, i === 0 ? tituloReserva : puntos[i - 1].titulo, i === 0);
  }
  const resto = doc.createElement('div');
  while (cuerpo.firstChild) resto.appendChild(cuerpo.firstChild);
  guardar(resto, puntos.length ? puntos.at(-1).titulo : tituloReserva, !puntos.length);
  return partes;
}

function dividirPorIndice(doc, entradas, tituloReserva) {
  const cuerpo = doc.querySelector('body');
  const puntos = (entradas || []).map(e => ({ ...e, nodo: doc.getElementById(e.id) }))
    .filter(e => e.nodo && cuerpo.contains(e.nodo));
  if (puntos.length < 2) return [{ title: tituloReserva, content: cuerpo.innerHTML.trim() }];
  return cortar(doc, cuerpo, ordenar(puntos), tituloReserva);
}

function necesitaCorteGlobal(documentos, indice) {
  let visto = false;
  for (const d of documentos) {
    const nodos = ordenar((indice.get(d.ruta) || []).map(e => ({ nodo: buscarId(d.cuerpo, e.id) })).filter(e => e.nodo));
    if (!nodos.length) {
      if (visto && d.cuerpo.textContent.trim().length >= 200) return true;
      continue;
    }

    if (visto && textoAntes(d, nodos[0].nodo) >= 200) return true;
    visto = true;
  }
  return false;
}

function textoAntes(d, nodo) {
  const paseo = d.doc.createTreeWalker(d.cuerpo, 5);
  let largo = 0;
  for (let n = paseo.nextNode(); n && n !== nodo && largo < 200; n = paseo.nextNode()) {
    if (n.nodeType === 3) largo += n.data.trim().length;
  }
  return largo;
}

function dividirGlobal(crear, documentos, indice, tituloReserva) {
  const doc = crear('<!doctype html><html><body></body></html>');
  const cuerpo = doc.querySelector('body');
  const puntos = [];
  for (const d of documentos) {
    const caja = doc.createElement('div');
    for (const n of [...d.cuerpo.childNodes]) caja.appendChild(doc.importNode(n, true));
    cuerpo.appendChild(caja);
    for (const e of indice.get(d.ruta) || []) {
      const nodo = buscarId(caja, e.id);
      if (nodo) puntos.push({ ...e, nodo });
    }
  }
  return cortar(doc, cuerpo, ordenar(puntos), tituloReserva, 200);
}

module.exports = { leerIndice, dividirPorIndice, necesitaCorteGlobal, dividirGlobal };
