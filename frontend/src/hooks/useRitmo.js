import { useState, useEffect, useRef } from 'react';

export function useRitmo({ storyId, capitulo, indiceVivoRef }) {

  const inicioLecturaRef = useRef(0);
  const acumuladoRef = useRef(0);

  useEffect(() => {
    inicioLecturaRef.current = Date.now();

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        acumuladoRef.current += Date.now() - inicioLecturaRef.current;
      } else {
        inicioLecturaRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  }, []);

  useEffect(() => {
    const indiceQueTermina = indiceVivoRef.current;

    return () => {
      const total = acumuladoRef.current + (document.hidden ? 0 : Date.now() - inicioLecturaRef.current);
      acumuladoRef.current = 0;
      inicioLecturaRef.current = Date.now();
      window.api?.logReading?.(storyId, indiceQueTermina, total);
    };
  }, [capitulo, storyId, indiceVivoRef]);

  const [ritmo, setRitmo] = useState(null);
  useEffect(() => {
    let vivo = true;
    const pedir = window.api?.getReadingPace
      ? window.api.getReadingPace(storyId).catch(() => null)
      : Promise.resolve(null);
    pedir.then(r => { if (vivo) setRitmo(r); });
    return () => { vivo = false; };
  }, [storyId, capitulo]);

  return ritmo;
}
