const TECHO_OFFLINE_DEFECTO = 1024 * 1024 * 1024;
const TECHO_TRADUCCION_DEFECTO = 5 * 1024 * 1024;
const RESERVA_CUOTA_RATIO = 0.10;

function medirBytesUtf8(texto) {
  if (typeof texto !== 'string') return 0;
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texto).length;
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(texto, 'utf8');
  let b = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    b += c < 128 ? 1 : c < 2048 ? 2 : c < 55296 || c >= 57344 ? 3 : 4;
    if (c >= 55296 && c < 57344) i++;
  }
  return b;
}

function limitesDeViaje(configuracion = {}) {
  const cfg = configuracion || {};
  return {
    techoOffline: Number.isFinite(cfg.techoOffline) && cfg.techoOffline > 0
      ? cfg.techoOffline : Number.isFinite(cfg.maxBytesOffline) && cfg.maxBytesOffline > 0
        ? cfg.maxBytesOffline : TECHO_OFFLINE_DEFECTO,
    techoTraduccion: Number.isFinite(cfg.techoTraduccion) && cfg.techoTraduccion > 0
      ? cfg.techoTraduccion : TECHO_TRADUCCION_DEFECTO,
    reservaRatio: Number.isFinite(cfg.reservaRatio) && cfg.reservaRatio >= 0 && cfg.reservaRatio < 1
      ? cfg.reservaRatio : RESERVA_CUOTA_RATIO
  };
}

function estimarPendiente(estado = {}, tamañosConocidos = null) {
  if (!estado) return 0;
  if (Number.isFinite(estado.bytesNecesarios)) return Math.max(0, estado.bytesNecesarios);
  if (Number.isFinite(estado.ficha?.bytesEstimados) && !estado.guardados) {
    return Math.max(0, estado.ficha.bytesEstimados);
  }
  const total = Number.isInteger(estado.total) ? estado.total : 0;
  const guardados = Number.isInteger(estado.guardados) ? estado.guardados : 0;
  const restantes = Math.max(0, total - guardados);
  if (restantes === 0) return 0;
  if (Array.isArray(tamañosConocidos)) {
    let suma = 0;
    for (let i = guardados; i < total; i++) suma += (tamañosConocidos[i] || 51200);
    return suma;
  }
  const porCapitulo = (estado.idioma ? 102400 : 51200);
  return restantes * porCapitulo;
}

function comprobarEspacioViaje(estado, estimacion, limites) {
  const limitesEff = limitesDeViaje(limites);
  let disponibles = limitesEff.techoOffline;
  if (estimacion && Number.isFinite(estimacion.quota) && Number.isFinite(estimacion.usage)) {
    const reserva = Math.floor(estimacion.quota * limitesEff.reservaRatio);
    const utilizables = Math.max(0, estimacion.quota - estimacion.usage - reserva);
    disponibles = Math.min(disponibles, utilizables);
  }
  const necesarios = typeof estado === 'number' ? estado : estimarPendiente(estado);
  const permitido = disponibles > 0 && disponibles >= necesarios;
  return {
    permitido,
    necesarios,
    disponibles,
    limite: limitesEff.techoOffline,
    motivo: permitido ? null : 'No queda espacio para guardar esta obra en el móvil.'
  };
}

function comprobarImagenesViaje(datos = {}, estimacion = null, limites = null) {
  const l = limitesDeViaje(limites);
  const necesarios = Math.max(0, Number(datos.bytesNuevos) || 0);
  const ocupado = Math.max(0, (Number(datos.bytesGuardados) || 0) - (Number(datos.bytesPrevios) || 0));
  let disponibles = Math.max(0, l.techoOffline - ocupado);
  if (estimacion && Number.isFinite(estimacion.quota) && Number.isFinite(estimacion.usage)) {
    disponibles = Math.min(disponibles, Math.max(0, estimacion.quota - estimacion.usage - Math.floor(estimacion.quota * l.reservaRatio)));
  }
  const permitido = necesarios <= disponibles;
  return { permitido, necesarios, disponibles, limite: l.techoOffline,
    motivo: permitido ? null : 'No queda espacio para guardar esta obra en el móvil.' };
}

function comprobarContenidoViaje(tipo, contenido, limites) {
  const limitesEff = limitesDeViaje(limites);
  const bytes = typeof contenido === 'number' ? contenido : medirBytesUtf8(contenido);
  if (tipo === 'traduccion' && bytes > limitesEff.techoTraduccion) {
    return {
      permitido: false,
      bytes,
      limite: limitesEff.techoTraduccion,
      motivo: `La traducción (${Math.round(bytes / 1048576)} MiB) supera el techo de 5 MiB por capítulo.`
    };
  }
  return { permitido: true, bytes, limite: limitesEff.techoOffline, motivo: null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TECHO_OFFLINE_DEFECTO,
    TECHO_TRADUCCION_DEFECTO,
    RESERVA_CUOTA_RATIO,
    medirBytesUtf8,
    limitesDeViaje,
    estimarPendiente,
    comprobarEspacioViaje,
    comprobarImagenesViaje,
    comprobarContenidoViaje
  };
}
