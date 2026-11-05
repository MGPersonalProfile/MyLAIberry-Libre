import { useEffect } from 'react';

export const EVENTO_PREGUNTA = 'mylaiberry:pregunta-al-asistente';
let pendiente = null;

export function pedirAlAsistente(texto) {
  pendiente = String(texto || '').trim() || null;
  if (pendiente) window.dispatchEvent(new Event(EVENTO_PREGUNTA));
}

export function tomarPregunta() {
  const p = pendiente;
  pendiente = null;
  return p;
}

export function useAlPedirAlAsistente(accion, activo = true) {
  useEffect(() => {
    if (!activo) return undefined;
    window.addEventListener(EVENTO_PREGUNTA, accion);
    return () => window.removeEventListener(EVENTO_PREGUNTA, accion);
  }, [accion, activo]);
}
