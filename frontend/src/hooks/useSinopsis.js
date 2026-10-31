import { useState, useEffect, useRef } from 'react';

export function useSinopsis(story, lang) {
  const [recienTraducidas, setRecienTraducidas] = useState({});
  const [fallo, setFallo] = useState(null);

  const enVuelo = useRef(new Set());
  const [intento, setIntento] = useState(0);

  const clave = story ? `${story.id}:${lang}` : '';
  const original = story?.synopsis || '';
  const guardada = story?.sinopsisTraducida?.[lang];

  useEffect(() => {
    if (!story || !original || guardada || enVuelo.current.has(clave)) return;
    enVuelo.current.add(clave);

    let vivo = true;
    window.api?.translateSynopsis?.(story.id, lang)
      .then(r => {
        if (!vivo) return;
        if (r?.status === 'ok' && r.texto) {
          setRecienTraducidas(prev => ({ ...prev, [clave]: r.texto }));
          setFallo(null);
        } else {

          setFallo(r?.codigo || 'fallo');
        }
      })
      .catch(() => { if (vivo) setFallo('fallo'); })
      .finally(() => { enVuelo.current.delete(clave); });

    return () => { vivo = false; };
  }, [clave, original, guardada, story, lang, intento]);

  return {
    texto: guardada || recienTraducidas[clave] || original,

    fallo: guardada || recienTraducidas[clave] ? null : fallo,
    reintentar: () => { setFallo(null); setIntento(n => n + 1); }
  };
}