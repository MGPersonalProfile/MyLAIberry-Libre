import { useCallback, useEffect, useState } from 'react';
import { guardarCopia, resolverAudio } from '../voz-offline';

const REPASO_MS = 6000;

export function useAudioDelCapitulo({ obraId, capitulo, idioma, listo = true }) {
  const [e, setE] = useState({ clave: null, estado: 'sin', audio: null });
  const enElMovil = Boolean(window.api?.audioCapitulo) && !window.api?.guardarAudioCapitulo;

  const clave = `${obraId}:${capitulo}:${idioma || ''}`;
  const consultar = useCallback((pedir) => window.api.audioCapitulo(obraId, capitulo,
    { idioma: idioma || null, ...(pedir ? { pedir: true } : {}) }), [obraId, capitulo, idioma]);

  const aplicar = useCallback((respuesta) => {
    const sirve = respuesta?.estado === 'listo' && respuesta.uri && Array.isArray(respuesta.marcas) && respuesta.marcas.length;
    const estado = sirve ? 'listo' : (['falta', 'preparando'].includes(respuesta?.estado) ? respuesta.estado : 'sin');
    setE({ clave, estado, audio: sirve ? respuesta : null });
  }, [clave]);

  useEffect(() => {
    if (!enElMovil || obraId == null || !listo) return undefined;
    let vivo = true;
    resolverAudio({ clave, consultar: () => consultar(false) })
      .then(r => { if (vivo) aplicar(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [enElMovil, obraId, listo, clave, consultar, aplicar]);

  useEffect(() => {
    if (e.clave !== clave || e.estado !== 'preparando') return undefined;
    const reloj = setTimeout(() => { consultar(false).then(aplicar).catch(() => {}); }, REPASO_MS);
    return () => clearTimeout(reloj);
  }, [e, clave, consultar, aplicar]);

  const pedir = useCallback(() => {
    if (!enElMovil) return Promise.resolve();
    return consultar(true).then(aplicar).catch(() => {});
  }, [enElMovil, consultar, aplicar]);

  const actual = e.clave === clave ? e : { estado: 'sin', audio: null };

  const guardar = useCallback(() => {
    if (actual.audio && !actual.audio.local) guardarCopia({ clave, estado: actual.audio });
  }, [actual.audio, clave]);

  return { audio: actual.audio, estado: actual.estado, pedir, guardar };
}
