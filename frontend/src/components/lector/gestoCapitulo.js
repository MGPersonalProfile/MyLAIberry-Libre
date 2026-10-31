export function pasoPorGesto(inicio, fin, { seleccionado = false, panel = false, capitulo, total } = {}) {
  if (!inicio || !fin || seleccionado || panel || inicio.id !== fin.id) return 0;
  const dx = fin.x - inicio.x, dy = fin.y - inicio.y;
  if (fin.t - inicio.t > 700 || fin.t < inicio.t || Math.abs(dx) < 80) return 0;
  if (Math.abs(dx) < Math.abs(dy) * 1.6 || Math.abs(fin.scroll - inicio.scroll) > 12) return 0;
  if (dx > 0) return capitulo > 0 ? -1 : 0;
  return capitulo < total - 1 ? 1 : 0;
}
