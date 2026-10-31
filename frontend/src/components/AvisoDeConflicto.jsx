import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export default function AvisoDeConflicto({ equipo, alCerrar }) {
  const { t } = useI18n();
  if (!equipo) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] max-w-xl bg-amber-950/95 border border-amber-600/40 text-amber-100 rounded-lg px-5 py-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <p className="text-sm leading-snug">{t('sync.conflict', { equipo })}</p>
        <button
          onClick={alCerrar}
          className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
