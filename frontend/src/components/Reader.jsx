import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import useEsMovil from '../hooks/useEsMovil';
import useMandosVisibles from '../hooks/useMandosVisibles';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { useVoz } from '../hooks/useVoz';
import { useRitmo } from '../hooks/useRitmo';
import { useRecap } from '../hooks/useRecap';
import useAtajosLector from '../hooks/useAtajosLector';
import useGestoCapitulo from '../hooks/useGestoCapitulo';
import useDesplazamientoAutomatico from '../hooks/useDesplazamientoAutomatico';
import useAjustesLector from '../hooks/useAjustesLector';
import useMemoriaDeScroll from '../hooks/useMemoriaDeScroll';
import useAnclaEstable from '../hooks/useAnclaEstable';
import useReciboDeLectura from '../hooks/useReciboDeLectura';
import useTitulosDeCapitulo from '../hooks/useTitulosDeCapitulo';
import useSugerenciasDeFinal from '../hooks/useSugerenciasDeFinal';
import Mandos from './lector/Mandos';
import IndiceLateral from './lector/IndiceLateral';
import FinDeObra from './lector/FinDeObra';
import { restaurarCapitulo } from './lector/restaurar';
import ResumenPrevio from './lector/ResumenPrevio';
import NavegacionCapitulos from './lector/NavegacionCapitulos';
import avisoNoDescargado from './lector/avisoNoDescargado';
import AvisosDeCarga from './lector/AvisosDeCarga';
import PanelAsistente from './lector/PanelAsistente';
import MenuSubrayado from './lector/MenuSubrayado';
import CapituloComic from './lector/CapituloComic';

export default function Reader({ story, onClose, onLeerOtra, onAbrirAjustes }) {
  const { t, lang } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(story.currentChapter || 0),
    [revisionLectura, setRevisionLectura] = useState(story.lecturaRevision || 0);
  const [chapterContent, setChapterContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [esperandoCapitulo, setEsperandoCapitulo] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [traducido, setTraducido] = useState(false);
  const [traduciendo, setTraduciendo] = useState(false);
  const [progresoTrad, setProgresoTrad] = useState(0);
  const [errorTrad, setErrorTrad] = useState(null);
  const [infoTrad, setInfoTrad] = useState(null);
  const [contenidoTraducido, setContenidoTraducido] = useState(false);
  const [idiomaOriginal, setIdiomaOriginal] = useState(story.idiomaOriginal || 'en');
  const contentRef = useRef(null);

  const scrollRef = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const indiceVivoRef = useRef(currentChapterIndex);
  const traducidoRef = useRef(traducido);
  const tokenCargaRef = useRef(0), ultimoCargadoRef = useRef(null), emisorLecturaRef = useRef(null);

  useEffect(() => { traducidoRef.current = traducido; }, [traducido]);

  const idiomaDelTexto = contenidoTraducido ? (lang || 'es') : idiomaOriginal;

  const {
    lectorVozRef, vozActiva, ajustesVoz, alternarVoz, cambiarVoz,
    vocesDelIdioma, hayVozParaEsteIdioma, audioActivo, estadoAudio, pedirAudio, saltarFrase
  } = useVoz({ scrollRef, idioma: idiomaDelTexto, capitulo: currentChapterIndex,
    total: Math.max(story.chapterList?.length || 0, story.totalChapters || 0, 1), irA: setCurrentChapterIndex, listo: !isLoading && !traduciendo, obraId: story.id,
    variante: contenidoTraducido ? (lang || 'es') : 'original', titulo: story.title, tituloCapitulo: t('reader.chapter_n', { n: currentChapterIndex + 1 }) });

  const ritmo = useRitmo({ storyId: story.id, capitulo: currentChapterIndex, indiceVivoRef });

  const {
    recap, recapVisible, recapError, mejorandoRecap, mejorarRecap, cerrarRecap
  } = useRecap({
    storyId: story.id,
    capitulo: currentChapterIndex,
    ultimaLectura: story.lastReadAt,
    añadidaEn: story.addedAt
  });

  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const ajustes = useAjustesLector({ alLeerTraducido: setTraducido });

  useEffect(() => {
    if (!window.api) return;

    const cancelar = window.api.onTranslateProgress?.((d) => {
      if (String(d.fanficId) !== String(story.id)) return;
      if (d.step === 'traduciendo' && d.total) {
        setProgresoTrad(Math.round((d.hechos / d.total) * 100));
      }
    });

    return () => { if (typeof cancelar === 'function') cancelar(); };

  }, [story.id]);

  const esMovil = useEsMovil();
  const showControls = useMandosVisibles({ scrollRef, esMovil, fijos: showSettings || showTOC });
  const autoScroll = useDesplazamientoAutomatico({ scrollRef, esMovil, capitulo: currentChapterIndex });

  const pedirTraduccion = async (index) => {
    if (!window.api?.translateChapter || !traducidoRef.current) return;
    const token = tokenCargaRef.current;
    const vigente = () => token === tokenCargaRef.current
      && index === indiceVivoRef.current && traducidoRef.current;
    const visible = index === indiceVivoRef.current;
    if (visible) { setTraduciendo(true); setProgresoTrad(0); setErrorTrad(null); }

    try {
      const r = await window.api.translateChapter(story.id, index, lang);
      if (!vigente()) return;

      if (r?.status === 'ok') {
        if (r.mismoIdioma) {
          setIdiomaOriginal(r.idiomaOriginal || lang || 'es');
          setErrorTrad(t('reader.same_language'));
          return;
        }

        if (r.html) {
          lectorVozRef.current?.parar();
          setChapterContent(r.html);
          setInfoTrad({ integridad: r.integridad, procedencia: r.procedencia, cacheado: r.cacheado });
          setContenidoTraducido(true);
        }
      } else {
        setErrorTrad(r?.message || t('reader.translate_error'));
      }
    } catch (err) {

      if (vigente()) setErrorTrad(err?.message || t('reader.translate_error'));
    } finally {
      if (vigente()) { setTraduciendo(false); setProgresoTrad(0); }
    }
  };

  const alternarTraduccion = async () => {

    lectorVozRef.current?.parar();
    const nuevo = !traducido;
    traducidoRef.current = nuevo;
    setTraducido(nuevo);
    setErrorTrad(null);
    if (window.api?.updateSettings) window.api.updateSettings({ readTranslated: nuevo });

    if (nuevo) {
      await pedirTraduccion(currentChapterIndex);

      if (currentChapterIndex + 1 < totalChapters) {
        pedirTraduccion(currentChapterIndex + 1);
      }
    } else {
      const token = tokenCargaRef.current;
      try {
        const original = await window.api.getChapterContent(story.id, currentChapterIndex);
        if (original && token === tokenCargaRef.current && !traducidoRef.current) {
          setChapterContent(original);
          setContenidoTraducido(false);
        }
      } catch (err) {
        if (token === tokenCargaRef.current) setErrorTrad(err?.message || t('reader.translate_error'));
      }
    }
  };

  async function traerContenido(index, vigente) {
    let contenido = null;

    if (traducido && window.api.hasTranslation) {
      const lista = await window.api.hasTranslation(story.id, index, lang);
      if (!vigente()) return { abortada: true };
      if (lista) {
        const r = await window.api.translateChapter(story.id, index, lang);
        if (!vigente()) return { abortada: true };
        if (r?.status === 'ok' && !r.mismoIdioma) {
          contenido = r.html;
          setInfoTrad({ integridad: r.integridad, procedencia: r.procedencia, cacheado: r.cacheado });
          setContenidoTraducido(Boolean(contenido));
        }
      }
    }

    if (!contenido) {
      contenido = await window.api.getChapterContent(story.id, index);
      if (!vigente()) return { abortada: true };
    }

    return { contenido };
  }

  const restaurarScroll = (index, vigente) =>
    restaurarCapitulo(scrollRef.current, story.id, index, contenidoTraducido ? (lang || 'es') : 'original', vigente);

  async function loadChapter(index) {

    const miToken = ++tokenCargaRef.current;
    const vigente = () => tokenCargaRef.current === miToken;

    setIsLoading(true);
    setChapterContent('');
    setContenidoTraducido(false);
    setErrorTrad(null);
    setTraduciendo(false);
    setErrorCarga(null);
    setEsperandoCapitulo(false);

    try {
      if (!window.api) {
        setChapterContent(`<p>${t('reader.no_db')}</p>`);
      } else {
        if (ultimoCargadoRef.current !== null && ultimoCargadoRef.current !== index) {
          const subir = () => window.api.updateProgress(story.id, index); const progreso = await (emisorLecturaRef.current ? emisorLecturaRef.current.enSerie(subir) : subir()); if (!vigente()) return;
          if (Number.isInteger(progreso?.lecturaRevision)) setRevisionLectura(progreso.lecturaRevision); }
        ultimoCargadoRef.current = index;

        const { contenido, abortada } = await traerContenido(index, vigente);
        if (abortada) return;

        if (contenido) {
          setChapterContent(contenido);
          if (traducido) pedirTraduccion(index);
        } else {
          setEsperandoCapitulo(true);
          setChapterContent(avisoNoDescargado(t));
        }
      }

      setIsLoading(false);
      await restaurarScroll(index, vigente);
    } catch (err) {
      if (vigente()) setErrorCarga(err?.message || t('reader.load_error'));
    } finally {
      if (vigente()) setIsLoading(false);
    }
  }

  useEffect(() => {

    indiceVivoRef.current = currentChapterIndex;
    if (!ajustes.listos) return;

    loadChapter(currentChapterIndex);
    const carga = tokenCargaRef;
    return () => { carga.current++; };

  }, [currentChapterIndex, ajustes.listos, recarga]);

  useEffect(() => {
    if (!esperandoCapitulo || !window.api?.getChapterContent) return;
    let vivo = true;
    let consultando = false;
    const timer = setInterval(async () => {
      if (consultando) return;
      consultando = true;
      try {
        const texto = await window.api.getChapterContent(story.id, currentChapterIndex);
        if (vivo && texto) setRecarga(n => n + 1);
      } catch {  }
      finally { consultando = false; }
    }, 2000);
    return () => { vivo = false; clearInterval(timer); };
  }, [esperandoCapitulo, story.id, currentChapterIndex]);

  const avanceEnCapitulo = useMemoriaDeScroll({
    scrollRef, storyId: story.id, capitulo: currentChapterIndex,
    variante: contenidoTraducido ? (lang || 'es') : 'original',
    revisionInicial: revisionLectura, emisorRef: emisorLecturaRef
  });

  useAnclaEstable({ scrollRef, capitulo: currentChapterIndex,
    variante: contenidoTraducido ? (lang || 'es') : 'original',
    claves: [ajustes.cuerpo, ajustes.fuente, chapterContent] });

  const { punto: puntoDeLectura, parrafos: parrafosDelCapitulo } = useReciboDeLectura({
    storyId: story.id, capitulo: currentChapterIndex, avance: avanceEnCapitulo
  });

  const totalChapters = Math.max(story.chapterList?.length || 0, story.totalChapters || 0, 1);

  useGestoCapitulo({ scrollRef, esMovil, capitulo: currentChapterIndex, total: totalChapters,
    panel: showSettings || showTOC, irA: setCurrentChapterIndex });

  const tituloDe = useTitulosDeCapitulo({ story, traducido });

  const enUltimoCapitulo = currentChapterIndex === totalChapters - 1;
  const sugerencias = useSugerenciasDeFinal({ storyId: story.id, enUltimoCapitulo });

  useAtajosLector({
    capitulo: currentChapterIndex,
    total: totalChapters,
    irA: setCurrentChapterIndex,
    ajustesAbiertos: showSettings,
    indiceAbierto: showTOC,
    alternarAjustes: () => setShowSettings(prev => !prev),
    alternarIndice: () => setShowTOC(prev => !prev),
    cerrarPaneles: () => { setShowSettings(false); setShowTOC(false); },
    alCerrarRef: onCloseRef
  });

  const currentChapterTitle = story.chapterList && story.chapterList[currentChapterIndex]
    ? tituloDe(currentChapterIndex)
    : t('reader.chapter_n', { n: currentChapterIndex + 1 });

  const progressPercentage =
    ((currentChapterIndex + avanceEnCapitulo) / totalChapters) * 100;

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 z-[200] transition-colors duration-500 overflow-y-auto overflow-x-hidden ${ajustes.clases}`}
    >

      <MenuSubrayado scrollRef={scrollRef} story={story} capitulo={currentChapterIndex}
        variante={contenidoTraducido ? (lang || 'es') : 'original'} claves={[ajustes.cuerpo, ajustes.fuente, chapterContent]} />

      <div className="h-8 w-full drag-region fixed top-0 z-[210]" style={{ WebkitAppRegion: 'drag' }} />

      <Mandos
        esMovil={esMovil}
        visibles={showControls || showSettings || showTOC}
        porcentaje={progressPercentage}
        capitulo={currentChapterIndex}
        total={totalChapters}
        alIr={setCurrentChapterIndex}
        titulo={story.title}
        tituloCapitulo={currentChapterTitle}
        alCerrar={onClose}
        traducido={traducido}
        traduciendo={traduciendo}
        progresoTrad={progresoTrad}
        alAlternarTraduccion={alternarTraduccion}
        cargando={isLoading}
        vozActiva={vozActiva}
        hayVoz={hayVozParaEsteIdioma}
        alAlternarVoz={alternarVoz}
        barraDeVoz={{ audioActivo, estadoAudio, pedirAudio, saltarFrase, velocidad: ajustesVoz.velocidadVoz,
          alCambiarVelocidad: (v) => cambiarVoz({ velocidadVoz: v }) }}
        autoActivo={autoScroll.activo}
        alAlternarAuto={autoScroll.alternar}
        indiceAbierto={showTOC}
        alAlternarIndice={() => { setShowTOC(!showTOC); setShowSettings(false); }}
        asistenteAbierto={asistenteAbierto}
        alAlternarAsistente={() => { setAsistenteAbierto(a => !a); setShowSettings(false); }}
        ajustesAbiertos={showSettings}
        alAlternarAjustes={() => setShowSettings(!showSettings)}
        ajustes={{
          tema: ajustes.tema, alCambiarTema: ajustes.cambiarTema,
          fuente: ajustes.fuente, alCambiarFuente: ajustes.cambiarFuente,
          cuerpo: ajustes.cuerpo, alCambiarCuerpo: ajustes.cambiarCuerpo,
          hayVoz: hayVozParaEsteIdioma, vocesDelIdioma, ajustesVoz,
          alCambiarVoz: cambiarVoz,
          autoVelocidad: autoScroll.velocidad, alCambiarAutoVelocidad: autoScroll.cambiarVelocidad,
          audio: { obraId: story.id, capitulo: currentChapterIndex, idioma: contenidoTraducido ? (lang || 'es') : null }
        }}
      />

      <AnimatePresence>
        {showTOC && (
          <IndiceLateral
            capitulos={story.chapterList || []}
            actual={currentChapterIndex}
            obraId={story.id}
            idioma={lang || 'es'}
            descargados={story.downloadedChapters || 0}
            tituloDe={tituloDe}
            alElegir={(idx) => { setCurrentChapterIndex(idx); setShowTOC(false); }}
            alCerrar={() => setShowTOC(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {asistenteAbierto && (
          <PanelAsistente
            punto={puntoDeLectura}
            parrafos={parrafosDelCapitulo}
            alCerrar={() => setAsistenteAbierto(false)}
          />
        )}
      </AnimatePresence>

      <div ref={contentRef} className="max-w-5xl mx-auto px-5 pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] md:px-8 md:py-32 min-h-screen flex flex-col relative z-10">
        <h1 className="text-[26px] md:text-5xl font-bold mb-10 md:mb-16 text-center leading-tight">
          {currentChapterTitle}
        </h1>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-50">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-red-500" />
            <p className="font-mono uppercase tracking-widest text-sm">{t('reader.loading')}</p>
          </div>
        ) : (
          <>
          <AvisosDeCarga
            errorCarga={errorCarga}
            errorTrad={errorTrad}
            traducido={traducido}
            traduciendo={traduciendo}
            contenidoTraducido={contenidoTraducido}
            infoTrad={infoTrad}
            alReintentarCarga={() => loadChapter(currentChapterIndex)}
            alReintentarTraduccion={() => pedirTraduccion(currentChapterIndex)}
          />

          {recapVisible && (
            <ResumenPrevio
              recap={recap}
              recapError={recapError}
              mejorandoRecap={mejorandoRecap}
              mejorarRecap={mejorarRecap}
              cerrarRecap={cerrarRecap}
              alAbrirAjustes={onAbrirAjustes}
            />
          )}
          <CapituloComic
            content={chapterContent}
            esComic={story?.tipo === 'comic' || story?.esComic}
            cuerpo={ajustes.cuerpo}
            lang={idiomaDelTexto}
          />
          </>
        )}

        <NavegacionCapitulos
          actual={currentChapterIndex}
          total={totalChapters}
          ritmo={ritmo}
          alIr={setCurrentChapterIndex}
        />

        {enUltimoCapitulo && (
          <FinDeObra sugerencias={sugerencias} alElegir={onLeerOtra} completa={story.completa} />
        )}
      </div>

    </div>
  );
}
