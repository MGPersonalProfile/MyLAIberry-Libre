function esqueleto(t) {
  return String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/(\p{L})\1+/gu, '$1');
}

function distancia(a, b, tope) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      menor = Math.min(menor, fila[j]);
    }
    if (menor > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

function conErratas(pedido, titulo) {
  const a = esqueleto(pedido), b = esqueleto(titulo);
  if (a.length < 4 || !b) return false;

  if (b === a || b.includes(a) || (b.length >= 4 && a.includes(b))) return true;
  const tope = Math.min(3, Math.floor(a.length / 6));
  return tope > 0 && distancia(a, b, tope) <= tope;
}

const VACIAS = new Set(['the', 'of', 'and', 'a', 'an', 'el', 'la', 'los', 'las', 'de', 'del', 'y', 'un', 'una']);
function nombraA(busqueda, titulo) {
  if (conErratas(busqueda, titulo)) return true;
  const palabras = esqueleto(busqueda).split(' ').filter(p => p.length > 2 && !VACIAS.has(p));
  const delTitulo = new Set(esqueleto(titulo).split(' '));
  return palabras.length >= 2 && palabras.every(p => delTitulo.has(p));
}

module.exports = { conErratas, esqueleto, nombraA };
