export function porDecidir(items = []) {
  return items.filter(o => o?.propuesta?.vence && !o.propuesta.adoptadaAlVencer)
    .sort((a, b) => a.propuesta.vence - b.propuesta.vence);
}

export function restante(vence, ahora = Date.now()) {
  const ms = Number(vence) - ahora;
  if (!(ms > 0)) return { clave: 'pending.now', n: 0 };
  const horas = Math.floor(ms / 3600000);
  if (horas >= 1) return { clave: 'pending.in_hours', n: horas };
  return { clave: 'pending.in_minutes', n: Math.max(1, Math.ceil(ms / 60000)) };
}
