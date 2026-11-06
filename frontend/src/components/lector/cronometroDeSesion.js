export const PAUSA_MAXIMA_MS = 60_000;
export const SESION_MAXIMA_MS = 30 * 60_000;

export const SALTO_MAXIMO = 0.08;
const MAX_TRAMOS = 50;
const idNuevo = () => globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function crearCronometro({ obraId, capitulo, deviceId, ahora = Date.now, id = idNuevo,
  zona = () => Intl.DateTimeFormat().resolvedOptions().timeZone }) {
  const inicio = ahora();
  let ultimo = inicio, activos = 0, oculta = false;
  const tramos = [];
  const sessionId = id();

  function latir(avance) {
    const t = ahora();
    if (!oculta) activos += Math.min(t - ultimo, PAUSA_MAXIMA_MS);
    ultimo = t;
    if (Number.isFinite(avance)) {
      const a = Math.min(1, Math.max(0, avance));
      const t = tramos[tramos.length - 1];
      if (t && a >= t.desde - SALTO_MAXIMO && a <= t.hasta + SALTO_MAXIMO) { t.desde = Math.min(t.desde, a); t.hasta = Math.max(t.hasta, a); }
      else { tramos.push({ desde: a, hasta: a }); if (tramos.length > MAX_TRAMOS) tramos.shift(); }
    }
  }
  const ocultar = (si) => { latir(); oculta = si; ultimo = ahora(); };
  const largo = () => ahora() - inicio >= SESION_MAXIMA_MS;

  function cerrar() {
    latir();
    if (activos < 10_000) return null;

    const leidos = tramos.filter(t => t.hasta > t.desde).map(t => ({ desde: t.desde, hasta: t.hasta }));
    const mayor = leidos.reduce((m, t) => (!m || t.hasta - t.desde > m.hasta - m.desde ? t : m), null);
    return { sessionId, deviceId, obraId: String(obraId), chapterId: capitulo, inicio, fin: ahora(),
      msActivos: Math.round(activos), zonaHoraria: zona(), tramos: leidos, tramo: mayor,
      terminado: tramos.some(t => t.hasta >= 0.97) };
  }
  return { latir, ocultar, cerrar, largo, sessionId };
}
