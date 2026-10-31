import { enElMovil } from './vistaGuardada';

const CLAVE = 'mylaiberry.letra';
export const LETRA_MOVIL_POR_DEFECTO = 18;
export const LETRA_MINIMA = 14;
export const LETRA_MAXIMA = 32;

const acotar = (n) => Math.max(LETRA_MINIMA, Math.min(LETRA_MAXIMA, Math.round(n)));

export function letraDelAparato(ajustes) {
  if (!enElMovil()) return ajustes?.fontSize || 18;
  try {
    const guardada = Number(localStorage.getItem(CLAVE));
    return guardada ? acotar(guardada) : LETRA_MOVIL_POR_DEFECTO;
  } catch {
    return LETRA_MOVIL_POR_DEFECTO;
  }
}

export function guardarLetra(tamano) {
  const valor = acotar(tamano);
  if (!enElMovil()) { window.api?.updateSettings?.({ fontSize: valor }); return valor; }
  try { localStorage.setItem(CLAVE, String(valor)); } catch {  }
  return valor;
}
