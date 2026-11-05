import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
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
      <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">{t('settings.pace')}</p>
      <p className="flex items-center gap-2 text-callout text-text-primary tabular-nums">
        <Gauge className="w-4 h-4 text-text-secondary" />
        {ritmo.ppm
          ? t('settings.pace_value', { ppm: Math.round(ritmo.ppm), n: ritmo.medidas })
          : t('settings.pace_pending', { n: Math.max(1, ritmo.faltan || 1) })}
      </p>
      {ritmo.medidas > 0 && (
        <SecondaryButton
          onClick={olvidar}
          title={t('settings.pace_reset_desc')}
          className="mt-3"
        >
          {t('settings.pace_reset')}
        </SecondaryButton>
      )}
    </div>
  );
}
