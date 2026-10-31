const CLAVE = 'mylaiberry.vista';

export const enElMovil = () => window.__MYLAIBERRY_BASE__ !== undefined;

export function guardarVista(id) {
  if (!enElMovil()) { window.api?.updateSettings?.({ vista: id }); return; }
  try { localStorage.setItem(CLAVE, id); } catch {  }
}

export function vistaGuardada(ajustes) {
  if (!enElMovil()) return ajustes?.vista || null;
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}
