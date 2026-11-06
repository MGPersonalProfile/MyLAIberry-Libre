export const nuevoId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function aparatoId(storage = globalThis.localStorage) {
  const clave = 'mylaiberry:deviceId';
  try {
    const guardado = JSON.parse(storage?.getItem(clave) || 'null');
    if (guardado) return guardado;
    const nuevo = nuevoId();
    storage?.setItem(clave, JSON.stringify(nuevo));
    return nuevo;
  } catch { return nuevoId(); }
}

export function nuevaOperacion(accion, anotacionId, revisionBase, cambios, aparato = aparatoId()) {
  return { operacionId: nuevoId(), aparatoId: aparato, anotacionId, accion, revisionBase, ...(cambios ? { cambios } : {}) };
}

export const listarSubrayados = (api, obra, desde = 0, capitulo) => api.listarSubrayados(obra, desde, capitulo);
export const operarSubrayado = (api, obra, operacion) => api.operarSubrayado(obra, operacion);
