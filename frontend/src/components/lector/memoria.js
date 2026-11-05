export const UMBRAL_PX = 50;
const INTENCION = ['wheel', 'touchstart', 'pointerdown'];

export function debeGuardar(scrollTop, porElUsuario) {
  return scrollTop > UMBRAL_PX || porElUsuario;
}

export function vigilarMemoria({ caja, guardar, medir = () => {}, doc = globalThis.document, win = globalThis.window, esperaMs = 500 }) {
  let temporizador;
  let porElUsuario = false;
  let pendiente = false;
  const tocar = () => { porElUsuario = true; if (caja.dataset) delete caja.dataset.restaurando; };
  const volcar = () => {
    clearTimeout(temporizador);
    temporizador = undefined;
    if (pendiente && debeGuardar(caja.scrollTop, porElUsuario)) guardar();
    pendiente = false;
  };
  const alScrollear = () => {
    medir();
    if (caja.dataset?.restaurando === '1') return;
    pendiente = true;
    clearTimeout(temporizador);
    temporizador = setTimeout(volcar, esperaMs);
  };
  const alOcultar = () => { if (doc.visibilityState === 'hidden') volcar(); };

  for (const e of INTENCION) caja.addEventListener(e, tocar, { passive: true });
  doc?.addEventListener('keydown', tocar);
  caja.addEventListener('scroll', alScrollear, { passive: true });
  doc?.addEventListener('visibilitychange', alOcultar);
  win?.addEventListener('pagehide', volcar);

  return () => {
    for (const e of INTENCION) caja.removeEventListener(e, tocar);
    doc?.removeEventListener('keydown', tocar);
    caja.removeEventListener('scroll', alScrollear);
    doc?.removeEventListener('visibilitychange', alOcultar);
    win?.removeEventListener('pagehide', volcar);
    volcar();
  };
}
