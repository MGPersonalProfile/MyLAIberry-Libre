import { useEffect, useState } from 'react';

export function useAudioDelCapitulo({ obraId, capitulo, idioma, listo = true }) {
  const [audio, setAudio] = useState(null);
  const enElMovil = Boolean(window.api?.audioCapitulo) && !window.api?.guardarAudioCapitulo;

  const clave = `${obraId}:${capitulo}:${idioma || ''}`;
  useEffect(() => {
    if (!enElMovil || obraId == null || !listo) return undefined;
    let vivo = true;
    window.api.audioCapitulo(obraId, capitulo, { idioma: idioma || null })
      .then(e => {
        if (!vivo) return;
        const sirve = e?.estado === 'listo' && e.uri && Array.isArray(e.marcas) && e.marcas.length;
        setAudio(sirve ? { ...e, clave } : null);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [enElMovil, obraId, capitulo, idioma, listo, clave]);

  return audio?.clave === clave ? audio : null;
}
