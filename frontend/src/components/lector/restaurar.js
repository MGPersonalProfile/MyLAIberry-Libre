import { resolverEnDom } from './anclaDom';

const cuadro = () => new Promise(ok => requestAnimationFrame(ok));

async function aplicar(caja, guardada, variante, vigente, antes) {
  if (!vigente() || caja.scrollTop !== antes) return false;
  const { top } = await resolverEnDom(guardada, caja, variante);
  if (!vigente() || caja.scrollTop !== antes) return false;
  const turno = (caja._a36Turno || 0) + 1;
  caja._a36Turno = turno;
  caja.dataset.restaurando = '1';
  caja.scrollTo({ top, behavior: 'instant' });
  setTimeout(() => { if (caja._a36Turno === turno) delete caja.dataset.restaurando; }, 100);
  return true;
}

export async function restaurarTrasLayout(caja, guardada, variante, vigente) {
  let interrumpido = false;
  const interrumpir = () => { interrumpido = true; delete caja.dataset.restaurando; };
  const sigue = () => vigente() && !interrumpido;
  for (const evento of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
    caja.addEventListener(evento, interrumpir, { passive: true });
  const soltar = () => {
    for (const evento of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      caja.removeEventListener(evento, interrumpir);
  };
  await Promise.race([document.fonts?.ready || Promise.resolve(),
    new Promise(ok => setTimeout(ok, 1200))]);
  await cuadro(); await cuadro();
  const antes = caja.scrollTop;
  if (!await aplicar(caja, guardada, variante, sigue, antes)) { soltar(); return; }
  const contenido = caja.querySelector('.reader-content');
  if (!contenido || typeof ResizeObserver === 'undefined') { soltar(); return; }
  let intentos = 0, cola = Promise.resolve();
  const observador = new ResizeObserver(() => {
    if (intentos >= 4 || !sigue()) { observador.disconnect(); soltar(); return; }
    intentos++;
    cola = cola.then(() => aplicar(caja, guardada, variante, sigue, caja.scrollTop)).catch(() => {});
  });
  observador.observe(contenido);
  setTimeout(() => { observador.disconnect(); soltar(); }, 1500);
}
