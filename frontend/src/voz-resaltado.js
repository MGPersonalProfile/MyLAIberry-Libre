export const NOMBRE_RESALTADO = 'frase-sonando';

export function rangoDeFrase(el, desde, hasta) {
  const doc = el?.ownerDocument;
  if (!doc || !(hasta > desde) || desde < 0) return null;
  const paseo = doc.createTreeWalker(el, 4 );
  let pos = 0;
  let aTrasEspacio = true;
  let inicio = null;
  let fin = null;
  for (let nodo = paseo.nextNode(); nodo && !fin; nodo = paseo.nextNode()) {
    if (nodo.parentElement?.closest('[hidden]')) continue;
    const texto = nodo.data;
    for (let k = 0; k < texto.length && !fin; k++) {
      const espacio = /\s/u.test(texto[k]);
      if (espacio && aTrasEspacio) continue;
      aTrasEspacio = espacio;
      if (pos === desde) inicio = [nodo, k];
      pos++;
      if (pos === hasta) fin = [nodo, k + 1];
    }
  }
  if (!inicio || !fin) return null;
  const rango = doc.createRange();
  rango.setStart(...inicio);
  rango.setEnd(...fin);
  return rango;
}

export function resaltarFrase(win, rango) {
  const resaltados = win?.CSS?.highlights;
  if (!resaltados || !win.Highlight) return false;
  if (!rango) { resaltados.delete(NOMBRE_RESALTADO); return true; }
  resaltados.set(NOMBRE_RESALTADO, new win.Highlight(rango));
  return true;
}

export function quitarResaltado(win) {
  win?.CSS?.highlights?.delete(NOMBRE_RESALTADO);
}
