import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

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
    <div className="mt-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-white font-medium">{t('settings.check_all_title')}</p>
        <p className={`text-xs mt-0.5 max-w-lg ${estado?.tipo === 'error' ? 'text-red-400' : 'text-gray-500'}`} role="status">
          {estado?.texto || t('settings.check_all_desc')}
        </p>
      </div>
      <button onClick={lanzar} disabled={estado?.tipo === 'trabajando'}
              className="shrink-0 px-4 py-2 max-md:min-h-11 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:border-white/25 disabled:opacity-50 flex items-center gap-2 transition-colors">
        <RefreshCw className={`w-4 h-4 ${estado?.tipo === 'trabajando' ? 'animate-spin' : ''}`} /> {t('settings.check_all_go')}
      </button>
    </div>
  );
}
