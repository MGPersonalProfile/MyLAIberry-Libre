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

function dividirPorIndice(doc, entradas, tituloReserva) {
  const cuerpo = doc.querySelector('body');
  const puntos = (entradas || []).map(e => ({ ...e, nodo: doc.getElementById(e.id) }))
    .filter(e => e.nodo && cuerpo.contains(e.nodo));
  puntos.sort((a, b) => a.nodo === b.nodo ? 0 : (a.nodo.compareDocumentPosition(b.nodo) & 4 ? -1 : 1));
  if (puntos.length < 2) return [{ title: tituloReserva, content: cuerpo.innerHTML.trim() }];
  const partes = [];
  for (let i = -1; i < puntos.length; i++) {
    const rango = doc.createRange();
    if (i < 0) rango.setStart(cuerpo, 0); else rango.setStartBefore(puntos[i].nodo);
    if (i + 1 < puntos.length) rango.setEndBefore(puntos[i + 1].nodo); else rango.setEnd(cuerpo, cuerpo.childNodes.length);
    const fragmento = rango.cloneContents();
    if (!fragmento.textContent.trim()) continue;
    const caja = doc.createElement('div'); caja.appendChild(fragmento);
    partes.push({ title: i < 0 ? tituloReserva : puntos[i].titulo, content: caja.innerHTML });
  }
  return partes;
}

module.exports = { leerIndice, dividirPorIndice };
