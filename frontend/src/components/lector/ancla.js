const SELECTOR = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,pre,div';

export function anclaDe(scrollTop, hojas) {
  if (!hojas.length) return null;
  let indice = 0;
  for (let i = 0; i < hojas.length; i++) {
    if (hojas[i].top <= scrollTop) indice = i;
    else break;
  }
  const h = hojas[indice];
  const fraccion = h.alto > 0 ? Math.min(1, Math.max(0, (scrollTop - h.top) / h.alto)) : 0;
  return { indice, fraccion, total: hojas.length };
}

export function alturaDeAncla(ancla, hojas) {
  if (!ancla || typeof ancla.indice !== 'number' || !hojas.length) return null;
  const indice = ancla.total === hojas.length || !ancla.total
    ? ancla.indice
    : Math.round(ancla.indice * hojas.length / ancla.total);
  const h = hojas[Math.min(hojas.length - 1, Math.max(0, indice))];
  return Math.round(h.top + (ancla.fraccion || 0) * h.alto);
}

function textoVisible(n) {
  if (!n.querySelector('[hidden]')) return n.textContent.trim();
  const copia = n.cloneNode(true);
  copia.querySelectorAll('[hidden]').forEach(e => e.remove());
  return copia.textContent.trim();
}

export function hojasDe(caja) {
  const texto = caja?.querySelector('.reader-content');
  if (!texto) return [];
  const origen = caja.getBoundingClientRect().top - caja.scrollTop;

  const visible = n => !n.closest('[hidden]');
  return [...texto.querySelectorAll(SELECTOR)]
    .filter(n => visible(n) && ![...n.querySelectorAll(SELECTOR)].some(visible) && textoVisible(n))
    .map(n => {
      const r = n.getBoundingClientRect();
      return { top: r.top - origen, alto: r.height };
    });
}

export function posicionDe(caja) {
  return { px: caja.scrollTop, ancla: anclaDe(caja.scrollTop, hojasDe(caja)) };
}

export function alturaGuardada(guardada, caja) {
  if (typeof guardada === 'number') return guardada;
  if (!guardada || typeof guardada !== 'object') return 0;
  const porTexto = alturaDeAncla(guardada.ancla, hojasDe(caja));
  return porTexto ?? (guardada.px || 0);
}
