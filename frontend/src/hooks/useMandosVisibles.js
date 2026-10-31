import { useEffect, useState } from 'react';

export default function useMandosVisibles({ scrollRef, esMovil, fijos }) {
  const [visibles, setVisibles] = useState(true);

  useEffect(() => {
    if (esMovil) return undefined;
    let espera;
    const alMover = () => {
      if (fijos) return;
      setVisibles(true);
      clearTimeout(espera);
      espera = setTimeout(() => setVisibles(false), 3000);
    };
    window.addEventListener('mousemove', alMover);
    return () => { window.removeEventListener('mousemove', alMover); clearTimeout(espera); };
  }, [esMovil, fijos]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!esMovil || !el) return undefined;
    const alTocar = (e) => {
      if (fijos || e.target.closest('a, button, input, select, textarea, [role="dialog"], [data-mandos]')) return;
      if (String(window.getSelection?.() || '').trim()) return;
      setVisibles(v => !v);
    };
    let ultimo = el.scrollTop;
    const alDesplazar = () => {
      const y = el.scrollTop;
      if (y > ultimo + 12 && y > 80 && !fijos) setVisibles(false);
      ultimo = y;
    };
    el.addEventListener('click', alTocar);
    el.addEventListener('scroll', alDesplazar, { passive: true });
    return () => { el.removeEventListener('click', alTocar); el.removeEventListener('scroll', alDesplazar); };
  }, [scrollRef, esMovil, fijos]);

  return visibles;
}
