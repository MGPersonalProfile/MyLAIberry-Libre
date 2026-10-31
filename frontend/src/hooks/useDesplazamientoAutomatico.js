import { useEffect, useState } from 'react';
import { siguienteScroll } from '../components/lector/desplazamiento';

export default function useDesplazamientoAutomatico({ scrollRef, esMovil, capitulo }) {
  const [capituloActivo, setCapituloActivo] = useState(null);
  const [velocidad, setVelocidad] = useState(30);
  const activo = esMovil && capituloActivo === capitulo;

  useEffect(() => {
    const el = scrollRef.current;
    if (!activo || !el) return undefined;
    let marco, anterior = 0, posicion = el.scrollTop;
    const detener = () => setCapituloActivo(null);
    const paso = tiempo => {
      if (!anterior) anterior = tiempo;
      const maximo = Math.max(0, el.scrollHeight - el.clientHeight);

      if (Math.abs(el.scrollTop - posicion) > 2) posicion = el.scrollTop;
      posicion = siguienteScroll(posicion, maximo, velocidad, tiempo - anterior);
      el.scrollTop = posicion;
      anterior = tiempo;
      if (el.scrollTop >= maximo - 1) detener();
      else marco = requestAnimationFrame(paso);
    };
    const alOcultar = () => { if (document.hidden) detener(); };
    el.addEventListener('pointerdown', detener);
    el.addEventListener('wheel', detener, { passive: true });
    document.addEventListener('visibilitychange', alOcultar);
    marco = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(marco);
      el.removeEventListener('pointerdown', detener);
      el.removeEventListener('wheel', detener);
      document.removeEventListener('visibilitychange', alOcultar);
    };
  }, [scrollRef, activo, velocidad]);

  return { activo, velocidad, cambiarVelocidad: setVelocidad,
    alternar: () => setCapituloActivo(activo ? null : capitulo) };
}
