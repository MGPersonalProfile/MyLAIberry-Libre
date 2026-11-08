import { Check, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Girando, Notice } from '../ui/Feedback';
import { CLASE_CARD } from '../ui/clases';

export default function TarjetaPendiente({ pendiente, alDecidir }) {
  const { t } = useI18n();
  const { resumen, estado, error } = pendiente;

  return (
    <div className={`mt-3 ${CLASE_CARD} px-3 py-2.5 text-body text-text-primary`}>
      <p className="leading-snug">{resumen}</p>
      {estado === 'pendiente' && (
        <div className="mt-2 flex gap-2">
          <PrimaryButton size="sm" icon={Check} onClick={() => alDecidir(pendiente.id, true)}>{t('assistant.confirm_do')}</PrimaryButton>
          <SecondaryButton size="sm" icon={X} onClick={() => alDecidir(pendiente.id, false)}>{t('assistant.confirm_no')}</SecondaryButton>
        </div>
      )}
      {estado === 'enviando' && <Girando className="mt-2 w-4 h-4 text-text-secondary" />}
      {estado === 'hecho' && <p className="mt-1 text-caption text-text-secondary">✓ {t('assistant.confirm_done')}</p>}
      {estado === 'cancelado' && <p className="mt-1 text-caption text-text-secondary">{t('assistant.confirm_cancelled')}</p>}
      {estado === 'error' && <Notice tone="warning" compact className="mt-2">{error || t('assistant.confirm_error')}</Notice>}
    </div>
  );
}
