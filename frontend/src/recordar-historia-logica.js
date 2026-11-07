import { estaEmpezada } from './lecturas.js';

export function debeMostrarRecordatorio(obra) {
  return Boolean(obra) && estaEmpezada(obra);
}

export function capituloActual(obra) {
  return (Number(obra?.currentChapter) || 0) + 1;
}

export function evaluarRespuestaRecordatorio(respuesta) {
  const sinConstancia = !respuesta || respuesta.status !== 'ok' || Boolean(respuesta.sinEvidencia)
    || (typeof respuesta.limite === 'number' && respuesta.limite < 0) || !respuesta.texto;

  return {
    mostrarTexto: !sinConstancia,
    sinConstancia,
    mensaje: sinConstancia ? 'no sé por dónde vas' : null,
    texto: sinConstancia ? '' : String(respuesta.texto || '').trim()
  };
}
