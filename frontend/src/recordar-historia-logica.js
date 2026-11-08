import { estaEmpezada } from './lecturas.js';

export function debeMostrarRecordatorio(obra, { ahora = Date.now(), diasMinimos = 7 } = {}) {
  if (!obra || !estaEmpezada(obra)) return false;
  const cap = Number(obra.currentChapter) || 0;
  if (cap <= 0) return false;
  if (typeof obra.lastReadAt === 'number' && obra.lastReadAt > 0) {
    const limiteMs = diasMinimos * 24 * 60 * 60 * 1000;
    if (ahora - obra.lastReadAt < limiteMs) return false;
  }
  return true;
}

export function capituloActual(obra) {
  return (Number(obra?.currentChapter) || 0) + 1;
}

export function evaluarRespuestaRecordatorio(respuesta, obra = null) {
  if (!respuesta) {
    return { estado: 'sin_evidencia', mostrarTexto: false, sinConstancia: true, mensaje: 'no sé por dónde vas', texto: '' };
  }
  if (respuesta.status === 'offline' || respuesta.code === 'offline') {
    return { estado: 'sin_conexion', mostrarTexto: false, sinConstancia: false, mensaje: 'sin conexión', texto: '' };
  }
  if (respuesta.status === 'error' || respuesta.error) {
    return { estado: 'error', mostrarTexto: false, sinConstancia: false, mensaje: respuesta.message || 'error', texto: '' };
  }
  if (Boolean(respuesta.sinEvidencia) || (typeof respuesta.limite === 'number' && respuesta.limite < 0)) {
    return { estado: 'sin_evidencia', mostrarTexto: false, sinConstancia: true, mensaje: 'no sé por dónde vas', texto: '' };
  }
  const tieneLimite = typeof respuesta.limite === 'number' && Number.isInteger(respuesta.limite) && respuesta.limite >= 0;
  const capitulosValidos = !respuesta.capitulos || (Array.isArray(respuesta.capitulos)
    && respuesta.capitulos.every(c => Number.isInteger(c) && c >= 0 && c <= respuesta.limite));
  if (!tieneLimite || !capitulosValidos) {
    return { estado: 'error', mostrarTexto: false, sinConstancia: true, mensaje: 'no autorizado', texto: '' };
  }
  if (obra) {
    if (respuesta.obraId && String(respuesta.obraId) !== String(obra.id)) {
      return { estado: 'error', mostrarTexto: false, sinConstancia: true, mensaje: 'obra no coincide', texto: '' };
    }
    const capActual = Number.isInteger(obra.currentChapter) ? obra.currentChapter : null;
    if (capActual !== null) {
      if (respuesta.limite >= capActual || (Array.isArray(respuesta.capitulos) && respuesta.capitulos.some(c => c >= capActual))) {
        return { estado: 'error', mostrarTexto: false, sinConstancia: true, mensaje: 'límite no autorizado', texto: '' };
      }
    }
  }
  const tieneTexto = Boolean(typeof respuesta.texto === 'string' && respuesta.texto.trim());
  if (!tieneTexto) {
    return { estado: 'sin_contenido', mostrarTexto: false, sinConstancia: false, mensaje: 'sin contenido', texto: '' };
  }
  return {
    estado: 'disponible',
    mostrarTexto: true,
    sinConstancia: false,
    mensaje: null,
    texto: String(respuesta.texto).trim()
  };
}
