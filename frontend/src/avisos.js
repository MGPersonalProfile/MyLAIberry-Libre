export function avisar(texto, tipo = 'ok') {
  if (!texto) return;
  window.dispatchEvent(new CustomEvent('mylaiberry-aviso', { detail: { texto: String(texto), tipo, id: Date.now() + Math.random() } }));
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
  return esFalloDelPC(err) && /^Sin conexión con tu PC/.test(motivo(err));
}

export function exigir(r) {
  if (r && (r.status === 'error' || r.success === false)) {
    const e = new Error(r.message || 'el PC no pudo hacerlo');
    e.delPC = true;
    throw e;
  }
  return r;
}
