import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

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
    <div className="mt-32 mb-16 flex justify-between items-center border-t border-current pt-8 opacity-50">
      <button
        onClick={() => alIr(Math.max(0, actual - 1))}
        disabled={actual === 0}
        className="flex items-center gap-2 min-h-[48px] px-2 -mx-2 hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-5 h-5"/> {t('reader.prev')}
      </button>
      <span className="font-mono text-sm tracking-widest flex flex-col items-center leading-tight">
        {actual + 1} / {total}

        {ritmo?.restantes > 0 && (
          <span className="text-[10px] tracking-normal opacity-60 mt-1 font-sans not-italic">
            {t('reader.time_left', { tiempo: formatearTiempo(ritmo.restantes) })}
          </span>
        )}
      </span>
      <button
        onClick={() => alIr(Math.min(total - 1, actual + 1))}
        disabled={actual === total - 1}
        className="flex items-center gap-2 min-h-[48px] px-2 -mx-2 hover:opacity-100 transition-opacity font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {t('reader.next')} <ChevronRight className="w-5 h-5"/>
      </button>
    </div>
  );
}
