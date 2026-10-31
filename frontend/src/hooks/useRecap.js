import { useState, useEffect } from 'react';

export function useRecap({ storyId, capitulo, ultimaLectura, añadidaEn }) {

  const [recap, setRecap] = useState(null);
  const [recapAbierto, setRecapAbierto] = useState(false);

  const [recapDe, setRecapDe] = useState(null);
  const [recapError, setRecapError] = useState(null);
  const [mejorandoRecap, setMejorandoRecap] = useState(false);

  useEffect(() => {
    const anterior = capitulo - 1;
    const parada = Date.now() - (ultimaLectura || añadidaEn || Date.now());
    const HACE_MUCHO = 7 * 24 * 3600 * 1000;

    const haceFalta = anterior >= 0 && parada >= HACE_MUCHO && !!window.api?.getRecap;

    let vivo = true;

    const pedir = haceFalta
      ? window.api.getRecap(storyId, anterior).catch(() => null)
      : Promise.resolve(null);

    pedir.then(r => {
      if (!vivo) return;
      const sirve = r?.status === 'ok' && r.texto;
      setRecap(sirve ? r : null);
      setRecapDe(sirve ? anterior : null);
      setRecapAbierto(!!sirve);
      setRecapError(null);
    });

    return () => { vivo = false; };

  }, [storyId]);

  const recapVisible = recapAbierto && !!recap?.texto && recapDe === capitulo - 1;

  const mejorarRecap = async (rehacer = false) => {
    if (recapDe === null) return;
    setMejorandoRecap(true);
    setRecapError(null);
    try {
      const r = await window.api?.getRecap?.(storyId, recapDe, { conModelo: true, rehacer });

      if (r?.status === 'ok' && r.texto) setRecap(r);
      else setRecapError(r?.codigo || 'desconocido');
    } catch {
      setRecapError('desconocido');
    } finally {
      setMejorandoRecap(false);
    }
  };

  return { recap, recapVisible, recapError, mejorandoRecap, mejorarRecap, cerrarRecap: () => setRecapAbierto(false) };
}
