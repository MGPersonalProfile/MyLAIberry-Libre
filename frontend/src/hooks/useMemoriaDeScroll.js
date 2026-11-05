import { useState, useEffect, useRef } from 'react';
import { posicionDe } from '../components/lector/ancla';
import { posicionDeV2 } from '../components/lector/anclaDom';
import { crearEmisor } from '../components/lector/envioPosicion';
import { vigilarMemoria } from '../components/lector/memoria';

export default function useMemoriaDeScroll({ scrollRef, storyId, capitulo, variante, revisionInicial, emisorRef: externo }) {
  const [avance, setAvance] = useState(0);
  const propio = useRef(null);

  const emisorRef = externo || propio;
  const reanudadoRef = useRef(false);
  useEffect(() => {
    if (!window.api || !storyId) return;
    if (!emisorRef.current) emisorRef.current = crearEmisor(window.api, window.localStorage, storyId, revisionInicial);
    else emisorRef.current.actualizarRevision(revisionInicial);

  }, [storyId, revisionInicial]);

  useEffect(() => {
    const caja = scrollRef.current;
    if (!caja) return;
    if (!reanudadoRef.current) { reanudadoRef.current = true; emisorRef.current?.reanudar(); }

    const guardar = async () => {
      if (!window.api || !storyId) return;
      const pendiente = emisorRef.current.preparar(capitulo, posicionDe(caja));
      const posicion = await posicionDeV2(caja, { obra: storyId, capitulo, variante })
        .catch(() => posicionDe(caja));
      await emisorRef.current.enviar(pendiente, posicion);
    };
    const medirAvance = () => {
      const recorrido = caja.scrollHeight - caja.clientHeight;
      setAvance(recorrido > 0 ? Math.min(1, caja.scrollTop / recorrido) : 0);
    };

    medirAvance();

    return vigilarMemoria({ caja, guardar, medir: medirAvance });

  }, [capitulo, storyId, variante]);

  return avance;
}
