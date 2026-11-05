export function limitar(fn, espera, { reloj = Date, frame = cb => requestAnimationFrame(cb),
  poner = setTimeout, quitar = clearTimeout } = {}) {
  let ultimo = -Infinity;
  let timer = null;
  let activo = true;
  const llamar = () => {
    if (timer || !activo) return;
    const resta = Math.max(0, espera - (reloj.now() - ultimo));
    timer = poner(() => {
      timer = null;
      ultimo = reloj.now();
      frame(() => { if (activo) fn(); });
    }, resta);
  };
  const cancelar = () => { activo = false; if (timer) quitar(timer); timer = null; };
  return { llamar, cancelar };
}
