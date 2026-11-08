import { useState, useRef, useEffect } from 'react';
import { BookOpen, X, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Card } from './ui/Layout';
import { SecondaryButton, IconButton } from './ui/Buttons';
import { Notice } from './ui/Feedback';
import {
  debeMostrarRecordatorio,
  capituloActual,
  evaluarRespuestaRecordatorio
} from '../recordar-historia-logica';

export default function RecordarLectura({ obra, movil = false, className = '' }) {
  const { t, lang } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [evaluacion, setEvaluacion] = useState(null);

  const [obraActiva, setObraActiva] = useState(obra?.id);
  const [capActivo, setCapActivo] = useState(obra?.currentChapter);
  if (obra?.id !== obraActiva || obra?.currentChapter !== capActivo) {
    setObraActiva(obra?.id);
    setCapActivo(obra?.currentChapter);
    setAbierto(false);
    setCargando(false);
    setEvaluacion(null);
  }

  const obraRef = useRef(obra);
  const abiertoRef = useRef(abierto);
  useEffect(() => {
    obraRef.current = obra;
    abiertoRef.current = abierto;
  });

  if (!debeMostrarRecordatorio(obra)) return null;
  const n = capituloActual(obra);

  const cerrar = () => {
    setAbierto(false);
  };

  const alternar = async () => {
    if (abierto) {
      cerrar();
      return;
    }
    const idSolicitud = obra?.id;
    const capSolicitud = obra?.currentChapter;
    const peticionVigente = () => obraRef.current?.id === idSolicitud && obraRef.current?.currentChapter === capSolicitud && abiertoRef.current;
    setAbierto(true);
    setCargando(true);
    try {
      const res = await window.api?.recordarLectura?.(obra.id, 'breve', lang);
      if (!peticionVigente()) return;
      setEvaluacion(evaluarRespuestaRecordatorio(res, obraRef.current));
    } catch (err) {
      if (!peticionVigente()) return;
      const esOffline = typeof navigator !== 'undefined' && !navigator?.onLine
        || err?.message?.includes?.('fetch') || err?.message?.includes?.('offline') || err?.code === 'offline';
      setEvaluacion(evaluarRespuestaRecordatorio({ status: esOffline ? 'offline' : 'error', message: err?.message }, obraRef.current));
    } finally {
      if (peticionVigente()) setCargando(false);
    }
  };

  return (
    <div data-recordar-lectura className={`${className} my-2`}>
      <div className={`flex items-center gap-3 ${movil ? 'flex-col sm:flex-row items-start justify-between' : 'justify-between flex-wrap'}`}>
        <span data-recordar-capitulo className="text-small md:text-body text-text-primary font-medium">
          {t('reading.you_were_at_chapter', { n })}
        </span>
        <SecondaryButton
          data-recordar-boton
          size="sm"
          icon={Sparkles}
          onClick={alternar}
          disabled={cargando}
          aria-expanded={abierto}
          aria-controls="recordar-historia-panel"
          className="shrink-0"
        >
          {cargando ? t('reading.recall_loading') : t('reading.recall_story')}
        </SecondaryButton>
      </div>

      {abierto && (
        <Card
          id="recordar-historia-panel"
          role="region"
          aria-labelledby="recordar-historia-titulo"
          data-recordar-panel
          className="mt-3 bg-surface-secondary/75 border border-border/80 p-4"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-separator/60">
            <div id="recordar-historia-titulo" className="flex items-center gap-2 text-text-primary font-semibold text-sm">
              <BookOpen className="w-4 h-4 text-accent" />
              <span>{t('reading.recall_title')}</span>
            </div>
            <IconButton icon={X} onClick={cerrar} aria-label={t('common.close')} title={t('common.close')} />
          </div>
          {cargando && (
            <p role="status" aria-live="polite" className="text-footnote text-text-secondary animate-pulse">
              {t('reading.recall_loading')}
            </p>
          )}
          {!cargando && evaluacion?.estado === 'sin_evidencia' && (
            <Notice data-recordar-vacio role="status" aria-live="polite" variant="info" compact>
              {t('reading.no_evidence')}
            </Notice>
          )}
          {!cargando && evaluacion?.estado === 'sin_contenido' && (
            <Notice data-recordar-sin-contenido role="status" aria-live="polite" variant="info" compact>
              {t('reading.no_content')}
            </Notice>
          )}
          {!cargando && evaluacion?.estado === 'sin_conexion' && (
            <Notice data-recordar-offline role="alert" variant="warning" compact>
              {t('reading.recall_offline')}
            </Notice>
          )}
          {!cargando && evaluacion?.estado === 'error' && (
            <Notice data-recordar-error role="alert" variant="error" compact>
              {t('reading.recall_error')}
            </Notice>
          )}
          {!cargando && evaluacion?.estado === 'disponible' && evaluacion?.mostrarTexto && (
            <p data-recordar-texto role="status" aria-live="polite" className="text-body text-text-primary leading-relaxed whitespace-pre-line">
              {evaluacion.texto}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
