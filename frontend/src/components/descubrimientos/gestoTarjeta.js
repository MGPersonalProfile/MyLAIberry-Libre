const UMBRAL_DEFECTO = 80;
const TIEMPO_MAX_DEFECTO = 800;
const RATIO_HORIZONTAL_DEFECTO = 1.6;
const MAX_DESPLAZAMIENTO_SCROLL = 10;

export function accionPorGesto(inicio, fin, opciones = {}) {
  if (!inicio || !fin) return null;
  const umbral = opciones.umbralMin ?? UMBRAL_DEFECTO;
  const tiempoMax = opciones.tiempoMax ?? TIEMPO_MAX_DEFECTO;
  const ratio = opciones.ratioHorizontal ?? RATIO_HORIZONTAL_DEFECTO;
  const maxScroll = opciones.maxScroll ?? MAX_DESPLAZAMIENTO_SCROLL;

  if (Number.isFinite(inicio.scrollY) && Number.isFinite(fin.scrollY)) {
    if (Math.abs(fin.scrollY - inicio.scrollY) > maxScroll) return null;
  }

  const dx = fin.x - inicio.x;
  const dy = fin.y - inicio.y;
  const dt = (fin.t || Date.now()) - (inicio.t || 0);

  if (dt > tiempoMax) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < umbral) return null;
  if (absX < absY * ratio) return null;

  if (dx > 0) return 'guardar';
  if (dx < 0) return 'descartar';
  return null;
}
