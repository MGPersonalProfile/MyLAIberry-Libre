export function siguienteScroll(actual, maximo, velocidad, intervalo) {
  if (!(maximo > actual) || !(velocidad > 0)) return Math.max(0, Math.min(actual, maximo));
  const ms = Math.max(0, Math.min(50, intervalo));
  return Math.min(maximo, actual + velocidad * ms / 1000);
}
