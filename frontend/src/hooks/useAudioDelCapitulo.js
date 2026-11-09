import { useCallback, useEffect, useState } from 'react';
import { guardarCopia, resolverAudio } from '../voz-offline.js';

const REPASO_MS = 6000;

export function esCapituloVigente(claveActual, claveRespuesta) {
  return Boolean(claveActual && claveActual === claveRespuesta);
}

export function useAudioDelCapitulo({ obraId, capitulo, idioma, listo = true }) {
  const [e, setE] = useState({ clave: null, estado: 'sin', audio: null });
  const disponible = Boolean(window.api?.audioCapitulo);
  const esDesktop = Boolean(window.api?.guardarAudioCapitulo);

  const clave = `${obraId}:${capitulo}:${idioma || ''}`;
  const consultar = useCallback((pedir) => window.api.audioCapitulo(obraId, capitulo,
    { idioma: idioma || null, ...(pedir ? { pedir: true } : {}) }), [obraId, capitulo, idioma]);

  const aplicar = useCallback((respuesta) => {
    const sirve = respuesta?.estado === 'listo' && Boolean(respuesta.uri);
    const estado = sirve ? 'listo' : (['falta', 'preparando'].includes(respuesta?.estado) ? respuesta.estado : 'sin');
    const audio = sirve ? {
      ...respuesta,
      marcas: Array.isArray(respuesta.marcas) ? respuesta.marcas : [],
      frases: Array.isArray(respuesta.frases) ? respuesta.frases : null
    } : null;
    setE({ clave, estado, audio });
  }, [clave]);

  useEffect(() => {
    if (!disponible || obraId == null || !listo) return undefined;
    let vivo = true;
    resolverAudio({ obraId, capitulo, idioma, clave, consultar: () => consultar(false) })
      .then(r => { if (vivo && esCapituloVigente(clave, `${obraId}:${capitulo}:${idioma || ''}`)) aplicar(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [disponible, obraId, capitulo, idioma, listo, clave, consultar, aplicar]);

  useEffect(() => {
    if (e.clave !== clave || e.estado !== 'preparando') return undefined;
    const reloj = setTimeout(() => { consultar(false).then(aplicar).catch(() => {}); }, REPASO_MS);
    return () => clearTimeout(reloj);
  }, [e, clave, consultar, aplicar]);

  const pedir = useCallback(() => {
    if (!disponible) return Promise.resolve();
    return consultar(true).then(aplicar).catch(() => {});
  }, [disponible, consultar, aplicar]);

  const actual = e.clave === clave ? e : { estado: 'sin', audio: null };

  const guardar = useCallback(() => {
    if (!esDesktop && actual.audio && !actual.audio.local) guardarCopia({ clave, estado: actual.audio });
  }, [esDesktop, actual.audio, clave]);

  return { audio: actual.audio, estado: actual.estado, pedir, guardar };
}
