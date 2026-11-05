import { useState } from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import useActualizacion from '../hooks/useActualizacion';
import { pedirAlAsistente } from '../preguntaAlAsistente';

export default function AvisoDeVersion() {
  const { t } = useI18n();
  const { estado, instalando, error, actualizar } = useActualizacion();
  const [cerrado, setCerrado] = useState(false);

  if (!estado?.disponible || cerrado || !window.api?.instalarActualizacion) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] max-w-sm bg-zinc-900/95 border border-white/10 text-gray-100 rounded-xl px-5 py-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">{t('update.available', { version: estado.nueva })}</p>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={actualizar}
            disabled={instalando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            {instalando ? t('update.installing') : t('update.install')}
          </button>
          <button
            onClick={() => { pedirAlAsistente(t('update.whats_new_question')); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {t('update.whats_new')}
          </button>
          </div>
        </div>
        <button
          onClick={() => setCerrado(true)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
