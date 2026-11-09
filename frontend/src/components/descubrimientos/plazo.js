export const TAMANO_LOTE = 10;

export function porDecidir(items = []) {
  return items.filter(o => o?.propuesta?.vence && !o.propuesta.adoptadaAlVencer)
    .sort((a, b) => {
      const relA = a?.propuesta?.relevancia ?? a?.relevancia ?? 0;
      const relB = b?.propuesta?.relevancia ?? b?.relevancia ?? 0;
      if (relB !== relA) return relB - relA;
      return (a?.propuesta?.vence || 0) - (b?.propuesta?.vence || 0);
    });
}

export function loteDePropuestas(items = [], pagina = 0, tamano = TAMANO_LOTE) {
  const lista = porDecidir(items);
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const paginaActual = Math.min(Math.max(0, pagina), totalPaginas - 1);
  const inicio = paginaActual * tamano;
  const fin = inicio + tamano;
  const lote = lista.slice(inicio, fin);
  return {
    total,
    revisar: lote.length,
    totalPaginas,
    pagina: paginaActual,
    lote,
    haySiguiente: paginaActual + 1 < totalPaginas,
    hayAnterior: paginaActual > 0
  };
}

export function restante(vence, ahora = Date.now()) {
  const ms = Number(vence) - ahora;
  if (!(ms > 0)) return { clave: 'pending.now', n: 0 };
  const horas = Math.floor(ms / 3600000);
  if (horas >= 24) {
    const dias = Math.round(horas / 24);
    return { clave: 'pending.in_days', n: dias };
  }
  if (horas >= 1) return { clave: 'pending.in_hours', n: horas };
  return { clave: 'pending.in_minutes', n: Math.max(1, Math.ceil(ms / 60000)) };
}
