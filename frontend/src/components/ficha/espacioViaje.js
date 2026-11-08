import {
  limitesDeViaje,
  estimarPendiente,
  comprobarEspacioViaje,
  comprobarContenidoViaje
} from '../../../../electron/lan/cliente/cuota-viaje.js';

export { limitesDeViaje, estimarPendiente, comprobarEspacioViaje, comprobarContenidoViaje };

export async function prepararAlmacenamiento(storage, obraOpciones = null) {
  let estimacion = null;
  try {
    const est = await storage?.estimate?.();
    if (est && Number.isFinite(est.quota) && Number.isFinite(est.usage)) {
      estimacion = est;
    }
  } catch {  }

  const decision = comprobarEspacioViaje(obraOpciones || 0, estimacion);
  let persistente = null;
  if (decision.permitido) {
    try {
      if (storage?.persist) persistente = await storage.persist();
    } catch {
      persistente = false;
    }
  }
  return {
    permitido: decision.permitido,
    libres: decision.disponibles,
    necesarios: decision.necesarios,
    disponibles: decision.disponibles,
    limite: decision.limite,
    motivo: decision.motivo,
    persistente
  };
}
