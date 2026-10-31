import { useState, useEffect, useRef } from 'react';
import { Lector, parrafosDelDom, textoDe, elegirVoces, vocesDePersonajes } from '../voz';
import { elegirVocesPorGenero } from '../voz-genero';
import { LectorDeAudio, alinearMarcas } from '../voz-audio';
import { useAudioDelCapitulo } from './useAudioDelCapitulo';

function useMotorVoz(idioma) {
  const lectorVozRef = useRef(null);
  const sistemaRef = useRef(null);
  const audioRef = useRef(null);
  const [vozActiva, setVozActiva] = useState(false);
  const [parrafoHablado, setParrafoHablado] = useState(-1);
  const [voces, setVoces] = useState([]);
  const [ajustesVoz, setAjustesVoz] = useState({
    vozNarracion: '', vozDialogo: '', vozMujer: '', vozHombre: '', vocesPorPersonaje: {}, velocidadVoz: 1
  });

  useEffect(() => {
    const lector = new Lector();
    const audio = new LectorDeAudio();
    const avisar = () => {
      const activo = lectorVozRef.current;
      if (!activo) return;
      setVozActiva(activo.leyendo);
      setParrafoHablado(activo.leyendo ? activo.indice : -1);
    };
    lector.alCambiar = avisar;
    audio.alCambiar = avisar;
    lectorVozRef.current = lector;
    sistemaRef.current = lector;
    audioRef.current = audio;
    const cargarVoces = () => setVoces(window.speechSynthesis?.getVoices?.() || []);
    cargarVoces();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = cargarVoces;
    window.api?.getSettings?.().then(ajustes => setAjustesVoz({
      vozNarracion: ajustes?.vozNarracion || '',
      vozDialogo: ajustes?.vozDialogo || '',
      vozMujer: ajustes?.vozMujer || '',
      vozHombre: ajustes?.vozHombre || '',
      vocesPorPersonaje: ajustes?.vocesPorPersonaje || {},
      velocidadVoz: ajustes?.velocidadVoz || 1
    })).catch(() => {});
    return () => {
      lector.destruir();
      audio.destruir();
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => window.api?.alCambiarAjustes?.((cambio) => {
    if (typeof cambio?.velocidadVoz === 'number') setAjustesVoz(a => ({ ...a, velocidadVoz: cambio.velocidadVoz }));
  }), []);

  useEffect(() => {
    const elegidas = elegirVoces(voces, idioma, ajustesVoz);
    sistemaRef.current?.configurar({
      vozNarracion: elegidas.narracion,
      vozDialogo: elegidas.dialogo,
      vocesPorPersonaje: vocesDePersonajes(voces, ajustesVoz.vocesPorPersonaje),
      vocesPorGenero: elegirVocesPorGenero(voces, idioma, ajustesVoz, elegidas.narracion),
      velocidad: ajustesVoz.velocidadVoz
    });
    audioRef.current?.configurar({ velocidad: ajustesVoz.velocidadVoz });
  }, [voces, idioma, ajustesVoz]);
  return { lectorVozRef, sistemaRef, audioRef, vozActiva, parrafoHablado, voces, ajustesVoz, setAjustesVoz };
}

export function useVoz({ scrollRef, idioma, capitulo, total = 0, irA = null, listo = true, obraId = null }) {
  const motor = useMotorVoz(idioma);
  const {
    lectorVozRef, sistemaRef, audioRef, vozActiva, parrafoHablado,
    voces, ajustesVoz, setAjustesVoz
  } = motor;

  const audioDelCapitulo = useAudioDelCapitulo({ obraId, capitulo, idioma, listo });

  useEffect(() => {
    sistemaRef.current?.parar();
    audioRef.current?.parar();
  }, [capitulo, sistemaRef, audioRef]);

  const seguirRef = useRef(false);
  const alternarRef = useRef(null);
  const seguirDesdeArriba = useRef(false);
  useEffect(() => {
    const alAcabar = () => {
      if (irA && capitulo + 1 < total) { seguirRef.current = true; irA(capitulo + 1); }
    };
    for (const lector of [sistemaRef.current, audioRef.current]) if (lector) lector.alAcabar = alAcabar;
  }, [capitulo, total, irA, sistemaRef, audioRef]);
  useEffect(() => {
    if (!seguirRef.current || !listo) return;
    const espera = setTimeout(() => { seguirRef.current = false; alternarRef.current?.(); }, 1500);
    return () => clearTimeout(espera);
  }, [capitulo, listo]);

  useEffect(() => {
    if (parrafoHablado < 0) return;

    const actual = parrafosDelDom(scrollRef.current?.querySelector('.reader-content'))[parrafoHablado];
    if (!actual) return;

    actual.classList.add('sonando');
    actual.scrollIntoView({ block: 'center', behavior: 'smooth' });

    return () => actual.classList.remove('sonando');
  }, [parrafoHablado, scrollRef]);

  const parrafoVisible = () => {
    const caja = scrollRef.current;
    const nodos = parrafosDelDom(caja?.querySelector('.reader-content'));
    if (!nodos.length) return 0;

    const arriba = caja.getBoundingClientRect().top + 100;
    const i = nodos.findIndex(el => el.getBoundingClientRect().bottom > arriba);
    return i < 0 ? 0 : i;
  };

  const alternarVoz = () => {
    if (lectorVozRef.current?.leyendo) { lectorVozRef.current.parar(); return; }

    const nodos = parrafosDelDom(scrollRef.current?.querySelector('.reader-content'));
    const parrafos = nodos.map(textoDe);
    if (!parrafos.length) return;

    if (audioDelCapitulo && audioRef.current) {
      const audio = audioRef.current;
      lectorVozRef.current = audio;
      const nuevo = audio.src !== audioDelCapitulo.uri || audio.parrafos.length !== parrafos.length || audio.parrafos[0] !== parrafos[0];
      if (nuevo) {
        audio.usar({ src: audioDelCapitulo.uri, marcas: alinearMarcas(audioDelCapitulo.marcas, parrafos) });
        audio.configurar({ velocidad: ajustesVoz.velocidadVoz });
        audio.cargar(parrafos, seguirDesdeArriba.current ? 0 : parrafoVisible());
      }
      seguirDesdeArriba.current = false;
      audio.hablar();
      return;
    }

    const lector = sistemaRef.current;
    if (!lector || !window.speechSynthesis) return;
    lectorVozRef.current = lector;
    const elegidas = elegirVoces(voces, idioma, ajustesVoz);
    lector.configurar({
      vozNarracion: elegidas.narracion,
      vozDialogo: elegidas.dialogo,
      vocesPorPersonaje: vocesDePersonajes(voces, ajustesVoz.vocesPorPersonaje),
      vocesPorGenero: elegirVocesPorGenero(voces, idioma, ajustesVoz, elegidas.narracion),
      velocidad: ajustesVoz.velocidadVoz
    });

    const mismoTexto = lector.parrafos.length === parrafos.length &&
                       lector.parrafos[0] === parrafos[0];

    if (!mismoTexto) lector.cargar(parrafos, seguirDesdeArriba.current ? 0 : parrafoVisible());
    seguirDesdeArriba.current = false;
    lector.hablar();
  };

  useEffect(() => {
    alternarRef.current = () => { seguirDesdeArriba.current = true; alternarVoz(); };
  });

  const vocesDelIdioma = voces.filter(v => v.lang.toLowerCase().startsWith(idioma));

  const hayVozParaEsteIdioma = vocesDelIdioma.length > 0 || Boolean(audioDelCapitulo);

  const cambiarVoz = (cambios) => {
    const ajustes = { ...ajustesVoz, ...cambios };
    setAjustesVoz(ajustes);
    window.api?.updateSettings?.({
      vozNarracion: ajustes.vozNarracion,
      vozDialogo: ajustes.vozDialogo,
      vozMujer: ajustes.vozMujer,
      vozHombre: ajustes.vozHombre,
      vocesPorPersonaje: ajustes.vocesPorPersonaje,
      velocidadVoz: ajustes.velocidadVoz
    });
  };

  return {
    lectorVozRef,
    vozActiva,
    voces,
    ajustesVoz,
    alternarVoz,
    cambiarVoz,
    vocesDelIdioma,
    hayVozParaEsteIdioma,
    parrafoVisible
  };
}
