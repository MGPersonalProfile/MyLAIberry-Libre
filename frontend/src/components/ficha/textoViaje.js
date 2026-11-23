const capitulos = (k) => (Number(k) === 1 ? 'capítulo' : 'capítulos');

export function textoDeViaje(estado, total, activo) {
  const n = estado ? (estado.presentes ?? estado.guardados ?? 0) : 0;
  const cuenta = `${n} de ${total} ${capitulos(total)} ${Number(total) === 1 ? 'guardado' : 'guardados'}`;
  if (activo && n >= total && estado?.idioma) return `Guardando traducciones (${estado.idioma}) · ${cuenta}`;
  if (activo) return `${estado?.reanudando ? 'Reanudando' : 'Guardando'} · ${cuenta}`;
  if (estado?.completa && estado.total === total) return `${cuenta} · Disponible sin conexión`;
  if (estado?.completa && estado.total < total) return `Actualizar copia · ${estado.total} → ${total} ${capitulos(total)}`;
  if (!n) return `Guardar ${total} ${capitulos(total)}`;
  if (n >= total && estado?.idioma) return `${cuenta} · Faltan traducciones (${estado.idioma})`;
  return `${cuenta} · Pendiente de conexión`;
}
