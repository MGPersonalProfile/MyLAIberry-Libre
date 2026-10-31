import { Check, X, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function TarjetaPendiente({ pendiente, alDecidir }) {
  const { t } = useI18n();
  const { resumen, estado, error } = pendiente;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm">
      <p className="leading-snug">{resumen}</p>
      {estado === 'pendiente' && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => alDecidir(pendiente.id, true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 text-xs text-white transition-colors">
            <Check className="w-3.5 h-3.5" /> {t('assistant.confirm_do')}
          </button>
          <button onClick={() => alDecidir(pendiente.id, false)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs transition-colors">
            <X className="w-3.5 h-3.5" /> {t('assistant.confirm_no')}
          </button>
        </div>
      )}
      {estado === 'enviando' && <Loader2 className="mt-2 w-4 h-4 animate-spin opacity-60" />}
      {estado === 'hecho' && <p className="mt-1 text-[11px] opacity-60">✓ {t('assistant.confirm_done')}</p>}
      {estado === 'cancelado' && <p className="mt-1 text-[11px] opacity-60">{t('assistant.confirm_cancelled')}</p>}
      {estado === 'error' && <p className="mt-1 text-[11px] text-amber-400/90" role="alert">{error || t('assistant.confirm_error')}</p>}
    </div>
  );
}
