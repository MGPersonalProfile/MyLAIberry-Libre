import { RefreshCw, Sparkles } from 'lucide-react';
import { Seccion } from './piezas';
import { PrimaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';
import useActualizacion from '../../hooks/useActualizacion';
import { pedirAlAsistente } from '../../preguntaAlAsistente';

export default function SeccionVersion() {
  const { t } = useI18n();
  const { estado, instalando, error, actualizar } = useActualizacion();
  if (!estado) return null;

  return (
    <Seccion icono={RefreshCw} titulo={t('update.title')} descripcion={t('update.desc')}>
      <p className="text-callout text-text-primary tabular-nums">{t('update.current', { version: estado.actual })}</p>
      {estado.disponible && !window.api?.instalarActualizacion ? (
        <p className="text-footnote text-text-secondary mt-1">{t('update.on_pc', { version: estado.nueva })}</p>
      ) : estado.disponible ? (
        <PrimaryButton
          onClick={actualizar}
          disabled={instalando}
          className="mt-3"
        >
          {instalando ? t('update.installing') : t('update.install_version', { version: estado.nueva })}
        </PrimaryButton>
      ) : (
        <p className="text-footnote text-text-secondary mt-1">{t('update.up_to_date')}</p>
      )}
      {window.api?.asistenteChat && (
        <button
          onClick={() => pedirAlAsistente(t('update.whats_new_question'))}
          className="mt-3 ml-0 inline-flex items-center gap-2 text-footnote text-text-secondary hover:text-text-primary underline-offset-2 hover:underline"
        >
          <Sparkles className="w-4 h-4" /> {t('update.whats_new')}
        </button>
      )}
      {error && <Notice tone="danger" className="mt-2">{error}</Notice>}
    </Seccion>
  );
}
