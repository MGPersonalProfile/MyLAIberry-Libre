export function avisosDeTraduccion(info) {
  if (!info) return { aviso: null, pie: [] };
  const estado = info.integridad?.estado;
  const aviso = estado === 'incompleta' ? 'incompleta' : estado === 'sospechosa' ? 'sospechosa' : null;
  const pie = [];
  if (estado === 'completa') pie.push('completa');
  if (info.procedencia && !info.procedencia.confirmado) pie.push('procedencia_desconocida');
  else if (info.procedencia?.confirmado) pie.push(info.procedencia.mixto ? 'procedencia_mixta' : 'procedencia_google');
  if (info.cacheado) pie.push('cache');
  return { aviso, pie, detalle: aviso ? (info.integridad.incidencias || []).slice(0, 2) : [] };
}
