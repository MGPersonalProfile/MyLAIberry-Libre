import { textoDelEquipo } from './equipo.js';

export function avisar(texto, tipo = 'ok', accion = null, duracion = null) {
  if (!texto) return;
  const t = typeof tipo === 'object' && tipo !== null ? tipo.tipo || 'ok' : tipo;
  const a = typeof tipo === 'object' && tipo !== null ? tipo.accion : accion;
  const d = typeof tipo === 'object' && tipo !== null ? tipo.duracion : duracion;
  window.dispatchEvent(new CustomEvent('mylaiberry-aviso', {
    detail: {
      texto: String(texto),
      tipo: t,
      accion: a && typeof a === 'object' ? a : null,
      duracion: typeof d === 'number' ? d : null,
      id: Date.now() + Math.random()
    }
  }));
}

export function motivo(err) {
  return String(err?.message || err || '')
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '') || 'error desconocido';
}

export function esFalloDelPC(err) {
  return !!err && (err.delPC === true || /^Error invoking remote method/.test(String(err.message || '')));
}

export function esSinConexion(err) {
  return esFalloDelPC(err) && err.sinConexion === true;
}

export function exigir(r) {
  if (r && (r.status === 'error' || r.success === false)) {
    const e = new Error(r.message || textoDelEquipo('offline.no_pudo'));
    e.delPC = true;
    throw e;
  }
  return r;
}
