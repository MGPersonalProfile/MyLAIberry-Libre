const colas = new Map();
function enSeriePorObra(id, tarea) {
  const clave = String(id);
  const anterior = colas.get(clave) || Promise.resolve();
  const actual = anterior.catch(() => {}).then(tarea);
  colas.set(clave, actual);
  actual.finally(() => { if (colas.get(clave) === actual) colas.delete(clave); }).catch(() => {});
  return actual;
}

function sellar(obra, capitulo, posicion, ahora, { moverCapitulo = true } = {}) {
  const revision = (Number(obra.lecturaRevision) || 0) + 1;
  const recibidaEn = new Date(ahora).toISOString();
  obra.lecturaRevision = revision;
  obra.lecturaRecibidaEn = recibidaEn;
  if (moverCapitulo) obra.currentChapter = capitulo;
  obra.lastReadAt = ahora;
  obra.progresoEn = ahora;
  if (posicion !== undefined) {
    obra.scrollPositions ||= {};
    obra.scrollPositions[capitulo] = typeof posicion === 'object' && posicion
      ? { ...posicion, revision, recibidaEn } : posicion;
  }
  if (obra.capitulosNuevos) obra.capitulosNuevos = 0;
  return { aceptada: true, revision, recibidaEn };
}

function aplicarLectura(obra, lectura, ahora = Date.now(), opciones) {
  const revision = Number(obra.lecturaRevision) || 0;
  const mutaciones = obra.lecturaMutaciones || [];
  const duplicada = mutaciones.find(m => m.deviceId === lectura.deviceId && m.mutationId === lectura.mutationId);
  if (duplicada) return { aceptada: true, revision: duplicada.revision, recibidaEn: duplicada.recibidaEn };
  if (lectura.baseRevision !== revision) return { aceptada: false, revision,
    recibidaEn: obra.lecturaRecibidaEn || null };
  const resultado = sellar(obra, lectura.capitulo, lectura.posicion, ahora, opciones);
  obra.lecturaMutaciones = [...mutaciones.slice(-31), {
    deviceId: lectura.deviceId, mutationId: lectura.mutationId, ...resultado
  }];
  return resultado;
}

module.exports = { enSeriePorObra, aplicarLectura, sellar };
