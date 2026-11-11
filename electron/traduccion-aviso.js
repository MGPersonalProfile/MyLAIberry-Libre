const ESTADOS = {
  completa: 'sin señales de que falte nada',
  sospechosa: 'con señales de posibles fragmentos sin traducir o de algún corte, sin pruebas concluyentes',
  incompleta: 'incompleta: se ha encontrado una pérdida o fragmentos sin traducir',
  no_verificable: 'no verificable (falta el original)'
};

function frase(p, cacheado) {
  if (!p) return 'no se tradujo (ya estaba en el idioma de la app)';
  if (!p.confirmado) return cacheado ? 'el proveedor original no consta (traducción guardada sin metadatos de procedencia)' : 'no se pudo confirmar qué servicio la hizo';
  const por = p.clientes.map(c => `${c.id}: ${c.fragmentos} fragmentos`).join(', ');
  return `Google Translate (${p.mixto ? 'varios clientes, ' : 'cliente '}${por})`;
}

function quienYComo(r) {
  if (!r?.procedencia && !r?.integridad && !r?.mismoIdioma) return {};
  const i = r.integridad;
  return {
    procedencia: frase(r.procedencia, r.cacheado),
    ...(r.cacheado ? { origenDelTexto: 'recuperada de lo guardado, no traducida ahora' } : {}),
    ...(i ? { integridad: ESTADOS[i.estado] || i.estado, ...(i.incidencias?.length ? { incidencias: i.incidencias.slice(0, 3) } : {}) } : {})
  };
}

module.exports = { quienYComo, frase, ESTADOS };
