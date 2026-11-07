import { useState } from 'react';
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
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [evaluacion, setEvaluacion] = useState(null);
  const [error, setError] = useState(null);

  if (!debeMostrarRecordatorio(obra)) return null;
  const n = capituloActual(obra);

  const alternar = async () => {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    setCargando(true);
    setError(null);
    try {
      const res = await window.api?.recordarLectura?.(obra.id, 'breve');
      setEvaluacion(evaluarRespuestaRecordatorio(res));
    } catch (err) {
      setError(err?.message || 'Error');
      setEvaluacion(evaluarRespuestaRecordatorio(null));
    } finally {
      setCargando(false);
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
          className="shrink-0"
        >
          {cargando ? t('reading.recall_loading') : t('reading.recall_story')}
        </SecondaryButton>
      </div>

      {abierto && (
        <Card data-recordar-panel className="mt-3 bg-surface-secondary/75 border border-border/80 p-4">
          <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-separator/60">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
              <BookOpen className="w-4 h-4 text-accent" />
              <span>{t('reading.recall_title')}</span>
            </div>
            <IconButton icon={X} onClick={() => setAbierto(false)} aria-label={t('common.close')} title={t('common.close')} />
          </div>
          {cargando && (
            <p className="text-footnote text-text-secondary animate-pulse">{t('reading.recall_loading')}</p>
          )}
          {!cargando && evaluacion?.sinConstancia && (
            <Notice data-recordar-vacio variant="info" compact>
              {t('reading.no_evidence')}
            </Notice>
          )}
          {!cargando && evaluacion?.mostrarTexto && (
            <p data-recordar-texto className="text-body text-text-primary leading-relaxed whitespace-pre-line">
              {evaluacion.texto}
            </p>
          )}
          {error && !evaluacion?.mostrarTexto && (
            <Notice variant="error" compact className="mt-2">{error}</Notice>
          )}
        </Card>
      )}
    </div>
  );
}
