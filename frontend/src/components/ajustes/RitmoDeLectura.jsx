import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function RitmoDeLectura() {
  const { t } = useI18n();
  const [ritmo, setRitmo] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    window.api?.getReadingPace?.(null).then(r => { if (vivo) setRitmo(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [vuelta]);

  if (!ritmo) return null;
  const olvidar = async () => {
    await window.api?.updateSettings?.({ lecturas: [] });
    setVuelta(n => n + 1);
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">{t('settings.pace')}</p>
      <p className="flex items-center gap-2 text-sm text-gray-300 tabular-nums">
        <Gauge className="w-4 h-4 text-gray-500" />
        {ritmo.ppm
          ? t('settings.pace_value', { ppm: Math.round(ritmo.ppm), n: ritmo.medidas })
          : t('settings.pace_pending', { n: Math.max(1, ritmo.faltan || 1) })}
      </p>
      {ritmo.medidas > 0 && (
        <button
          onClick={olvidar}
          title={t('settings.pace_reset_desc')}
          className="mt-3 px-4 py-2 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:border-white/25 transition-colors"
        >
          {t('settings.pace_reset')}
        </button>
      )}
    </div>
  );
}
