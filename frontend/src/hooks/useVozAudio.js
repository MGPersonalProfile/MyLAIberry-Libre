import { useEffect, useRef } from 'react';
import { parrafosDelDom } from '../voz';
import { alinearMarcas, alinearFrases } from '../voz-audio';
import { conectarMediaSession } from '../voz-media';
import { rangoDeFrase, resaltarFrase, quitarResaltado } from '../voz-resaltado';
import { anclaDeAudio, retomarAudio, guardarPosicion, leerPosicion } from '../voz-posicion';
import { useAudioDelCapitulo } from './useAudioDelCapitulo';

export function useVozAudio({ audioRef, scrollRef, obraId, capitulo, idioma, listo, variante, titulo, tituloCapitulo, parrafoHablado, fraseHablada }) {

  const { audio: delCapitulo, estado: estadoAudio, pedir: pedirAudio, guardar } = useAudioDelCapitulo({ obraId, capitulo, idioma, listo });
  const mediaRef = useRef(null);
  const textosRef = useRef([]);

  useEffect(() => {
    const frase = audioRef.current?.frases?.[fraseHablada];
    if (!frase || parrafoHablado < 0) return undefined;
    const el = parrafosDelDom(scrollRef.current?.querySelector('.reader-content'))[frase.parrafo];
    if (!el) return undefined;
    resaltarFrase(window, rangoDeFrase(el, frase.desde, frase.hasta));
    return () => quitarResaltado(window);
  }, [fraseHablada, parrafoHablado, scrollRef, audioRef]);

  const guardarPosicionDeAudio = () => {
    const audio = audioRef.current;
    if (!audio?.audio || !textosRef.current.length) return;
    const meta = { obra: String(obraId), capitulo, variante };
    anclaDeAudio({ lector: audio, textos: textosRef.current, meta })
      .then(p => guardarPosicion(window.localStorage, meta, p)).catch(() => {});
  };
  const guardarRef = useRef(guardarPosicionDeAudio);
  useEffect(() => { guardarRef.current = guardarPosicionDeAudio; });

  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') guardarRef.current(); };
    const alIrse = () => guardarRef.current();
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', alIrse);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', alIrse);
      mediaRef.current?.desconectar();
    };
  }, [obraId, capitulo, variante]);

  const arrancar = ({ audio, parrafos, desdeArriba, visible, velocidad }) => {
    textosRef.current = parrafos;
    const empezar = () => { audio.hablar(); desdeArriba.current = false; guardar(); };
    const sinPrisa = desdeArriba.current;
    const nuevo = audio.src !== delCapitulo.uri || audio.parrafos.length !== parrafos.length || audio.parrafos[0] !== parrafos[0];
    if (!nuevo) { empezar(); return; }
    audio.usar({ src: delCapitulo.uri, marcas: alinearMarcas(delCapitulo.marcas, parrafos),
      frases: alinearFrases(delCapitulo.marcas, delCapitulo.frases, parrafos) });
    audio.configurar({ velocidad });
    audio.cargar(parrafos, sinPrisa ? 0 : visible());
    mediaRef.current?.desconectar();
    mediaRef.current = conectarMediaSession(audio, { titulo: tituloCapitulo || titulo, artista: titulo, album: titulo });
    const guardada = sinPrisa ? null : leerPosicion(window.localStorage, { obra: String(obraId), capitulo, variante });
    if (!guardada) { empezar(); return; }
    retomarAudio(guardada, { textos: parrafos, variante, lector: audio })
      .then(r => { if (r?.exacta && Math.abs(r.bloque - visible()) <= 3) audio.buscar(r.t); })
      .catch(() => {})
      .finally(empezar);
  };

  return { arrancar, guardarPosicionDeAudio, hayAudio: Boolean(delCapitulo), estadoAudio, pedirAudio };
}
