export function rectDeImagen(caja, original) {
  const escala = Math.min(caja.width / original.w, caja.height / original.h);
  const width = original.w * escala;
  const height = original.h * escala;
  return { left: caja.left + (caja.width - width) / 2, top: caja.top + (caja.height - height) / 2, width, height };
}

export function normalizarToque({ x, y }, caja, original) {
  const r = rectDeImagen(caja, original);
  const nx = (x - r.left) / r.width;
  const ny = (y - r.top) / r.height;
  if (!(nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1)) return null;
  return { x: nx, y: ny };
}
