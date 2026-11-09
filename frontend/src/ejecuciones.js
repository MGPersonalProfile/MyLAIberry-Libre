const TERMINALES = new Set(['completada', 'cancelada', 'fallida', 'interrumpida']);

export const CADUCIDAD_MS = 20000;

export const esTerminal = estado => TERMINALES.has(estado);
export const esViva = e => !!e && !esTerminal(e.estado);

export function aceptar(actual, nuevo) {
  if (!nuevo?.executionId) return false;
  if (!actual) return true;
  if (nuevo.updatedAt < actual.updatedAt) return false;
  if (esTerminal(actual.estado) && !esTerminal(nuevo.estado)) return false;
  return true;
}

export function fusionar(mapa, nuevo) {
  if (!aceptar(mapa[nuevo?.executionId], nuevo)) return mapa;
  return { ...mapa, [nuevo.executionId]: nuevo };
}

export function desdeLectura(mapa, lectura) {
  const lista = lectura?.ejecuciones || [];
  const ids = new Set(lista.map(e => e.executionId));
  const resto = Object.fromEntries(Object.entries(mapa).filter(([id]) => ids.has(id)));
  return lista.reduce(fusionar, resto);
}

export function deInvestigacion(mapa, investigationId) {
  const suyas = Object.values(mapa).filter(e => e.investigationId === investigationId);
  return suyas.find(esViva) || suyas.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

export const obsoleta = (leidoEn, ahora, tolerancia = CADUCIDAD_MS) => !leidoEn || ahora - leidoEn > tolerancia;

export const claveNueva = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
