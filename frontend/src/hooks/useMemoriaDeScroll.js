import { useState, useEffect } from 'react';
import { posicionDe } from '../components/lector/ancla';

export default function useMemoriaDeScroll({ scrollRef, storyId, capitulo }) {
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return;

    let espera;
    const guardar = () => {
      if (window.api && storyId && caja.scrollTop > 50) {

        window.api.saveScrollPosition(storyId, capitulo, posicionDe(caja));
      }
    };

    const medirAvance = () => {
      const recorrido = caja.scrollHeight - caja.clientHeight;
      setAvance(recorrido > 0 ? Math.min(1, caja.scrollTop / recorrido) : 0);
    };

    const alScrollear = () => {
      medirAvance();
      clearTimeout(espera);
      espera = setTimeout(guardar, 500);
    };

    medirAvance();
    caja.addEventListener('scroll', alScrollear, { passive: true });
    return () => {
      clearTimeout(espera);
      caja.removeEventListener('scroll', alScrollear);

      guardar();
    };

  }, [capitulo, storyId]);

  return avance;
}
