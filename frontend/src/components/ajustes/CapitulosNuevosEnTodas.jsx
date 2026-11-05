import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
import { useI18n } from '../../i18n/I18nContext';

export default function CapitulosNuevosEnTodas({ onHecho }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);

  if (!window.api?.refreshChaptersAll) return null;

  const lanzar = async () => {
    setEstado({ tipo: 'trabajando' });
    try {
      const r = await window.api.refreshChaptersAll();
      if (r?.status !== 'ok') throw new Error(r?.message);
      setEstado({ tipo: 'ok', texto: t('settings.check_all_done', { n: r.enCola }) });
      onHecho?.();
    } catch (err) {
      setEstado({ tipo: 'error', texto: err?.message || t('settings.check_all_failed') });
    }
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-callout text-text-primary font-medium">{t('settings.check_all_title')}</p>
        <p className={`text-footnote mt-0.5 max-w-lg ${estado?.tipo === 'error' ? 'text-danger' : 'text-text-secondary'}`} role="status">
          {estado?.texto || t('settings.check_all_desc')}
        </p>
      </div>
      <SecondaryButton onClick={lanzar} disabled={estado?.tipo === 'trabajando'} className="shrink-0">
        <RefreshCw className={`w-4 h-4 ${estado?.tipo === 'trabajando' ? 'animate-spin' : ''}`} /> {t('settings.check_all_go')}
      </SecondaryButton>
    </div>
  );
}
