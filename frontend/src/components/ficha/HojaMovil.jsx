import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';

export default function HojaMovil({ alCerrar, cabecera, children }) {
  const hoja = useRef(null);
  const y = useMotionValue(0);
  useTironParaCerrar(hoja, y, alCerrar);
  return (
    <motion.div
      ref={hoja}
      style={{ y }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 34, stiffness: 340 }}
      className="fixed inset-0 z-[150] bg-surface text-text-primary overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
    >
      {cabecera}
      <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">{children}</div>
    </motion.div>
  );
}

const DISTANCIA = 120;
const VELOCIDAD = 0.8;

function useTironParaCerrar(ref, y, alCerrar) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let inicio = null;
    const alEmpezar = (e) => {
      inicio = el.scrollTop <= 0 ? { y: e.touches[0].clientY, t: e.timeStamp } : null;
    };
    const alMover = (e) => {
      if (!inicio) return;
      const d = e.touches[0].clientY - inicio.y;
      if (d <= 0) { y.set(0); return; }
      e.preventDefault();
      y.set(d * 0.85);
    };
    const alSoltar = (e) => {
      if (!inicio) return;
      const d = y.get();
      const rapido = d / Math.max(1, e.timeStamp - inicio.t) > VELOCIDAD;
      inicio = null;
      if (d > DISTANCIA || (d > 30 && rapido)) alCerrar();
      else animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 });
    };
    el.addEventListener('touchstart', alEmpezar, { passive: true });
    el.addEventListener('touchmove', alMover, { passive: false });
    el.addEventListener('touchend', alSoltar);
    el.addEventListener('touchcancel', alSoltar);
    return () => {
      el.removeEventListener('touchstart', alEmpezar);
      el.removeEventListener('touchmove', alMover);
      el.removeEventListener('touchend', alSoltar);
      el.removeEventListener('touchcancel', alSoltar);
    };
  }, [ref, y, alCerrar]);
}
