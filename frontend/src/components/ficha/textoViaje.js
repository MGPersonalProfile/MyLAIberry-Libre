export function textoDeViaje(estado, total, activo) {
  const n = estado ? (estado.presentes ?? estado.guardados ?? 0) : 0;
  const cuenta = `${n} de ${total} capítulos guardados`;
  if (activo) return `${estado?.reanudando ? 'Reanudando' : 'Guardando'} · ${cuenta}`;
  if (estado?.completa && estado.total === total) return `${cuenta} · Disponible sin conexión`;
  if (estado?.completa && estado.total < total) return `Actualizar copia · ${estado.total} → ${total} capítulos`;
  if (!n) return `Guardar ${total} capítulos`;
  if (n >= total && estado?.idioma) return `${cuenta} · Faltan traducciones (${estado.idioma})`;
  return `${cuenta} · Pendiente de conexión`;
}
