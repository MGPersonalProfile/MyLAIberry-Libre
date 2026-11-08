import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';

function formatearTiempo(minutos) {
  if (minutos == null) return '';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h >= 10) return `${h} h`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${minutos} min`;
}

export default function NavegacionCapitulos({ actual, total, ritmo, alIr }) {
  const { t } = useI18n();

  return (
    <div className="mt-32 mb-16 flex justify-between items-center gap-3 border-t border-current/30 pt-8 font-sans">
      <SecondaryButton className="dark" icon={ChevronLeft} onClick={() => alIr(Math.max(0, actual - 1))} disabled={actual === 0}>
        {t('reader.prev')}
      </SecondaryButton>
      <span className="font-mono text-sm tracking-widest flex flex-col items-center leading-tight opacity-60">
        {actual + 1} / {total}

        {ritmo?.restantes > 0 && (
          <span className="text-[10px] tracking-normal opacity-80 mt-1 font-sans not-italic">
            {t('reader.time_left', { tiempo: formatearTiempo(ritmo.restantes) })}
          </span>
        )}
      </span>
      <SecondaryButton className="dark" onClick={() => alIr(Math.min(total - 1, actual + 1))} disabled={actual === total - 1}>
        {t('reader.next')} <ChevronRight className="w-4 h-4 shrink-0" />
      </SecondaryButton>
    </div>
  );
}
