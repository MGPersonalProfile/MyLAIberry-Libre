import { useEffect, useLayoutEffect, useRef } from 'react';
import { posicionDeV2, resolverEnDom } from '../components/lector/anclaDom';
import { limitar } from '../components/lector/limitar';

export default function useAnclaEstable({ scrollRef, capitulo, variante, claves }) {
  const vivaRef = useRef(null);

  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return undefined;
    let turno = 0;
    const anotar = async () => {
      if (caja.dataset.restaurando === '1') return;
      const este = ++turno;
      const posicion = await posicionDeV2(caja, { capitulo, variante });
      if (este === turno) vivaRef.current = { capitulo, posicion };
    };

    const limitada = limitar(anotar, 150);
    caja.addEventListener('scroll', limitada.llamar, { passive: true });
    return () => { turno++; limitada.cancelar(); caja.removeEventListener('scroll', limitada.llamar); };
  }, [scrollRef, capitulo, variante]);

  useLayoutEffect(() => {
    const caja = scrollRef.current;
    const viva = vivaRef.current;
    if (!caja || !viva || viva.capitulo !== capitulo || !viva.posicion) return;
    let activo = true;
    const antes = caja.scrollTop;
    resolverEnDom(viva.posicion, caja, variante).then(({ top }) => {
      if (!activo || caja.scrollTop !== antes) return;
      caja.dataset.restaurando = '1';
      caja.scrollTop = top;
      requestAnimationFrame(() => { delete caja.dataset.restaurando; });
    });
    return () => { activo = false; };

  }, claves);
}
