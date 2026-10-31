import { useEffect, useLayoutEffect, useRef } from 'react';
import { anclaDe, alturaDeAncla, hojasDe } from '../components/lector/ancla';

export default function useAnclaEstable({ scrollRef, capitulo, claves }) {
  const vivaRef = useRef(null);

  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return undefined;
    const anotar = () => {
      vivaRef.current = { capitulo, ancla: anclaDe(caja.scrollTop, hojasDe(caja)) };
    };
    caja.addEventListener('scroll', anotar, { passive: true });
    return () => caja.removeEventListener('scroll', anotar);
  }, [scrollRef, capitulo]);

  useLayoutEffect(() => {
    const caja = scrollRef.current;
    const viva = vivaRef.current;
    if (!caja || !viva || viva.capitulo !== capitulo || !viva.ancla) return;
    const top = alturaDeAncla(viva.ancla, hojasDe(caja));
    if (top !== null) caja.scrollTop = top;

  }, claves);
}
