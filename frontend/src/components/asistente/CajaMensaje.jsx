import { Send, Compass } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function CajaMensaje({ texto, setTexto, pensando, punto, fuera, setFuera, enviar }) {
  const { t } = useI18n();
  return (
      <div className="border-t border-white/10 p-3 md:p-4">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}

            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
            }}
            rows={1}
            placeholder={punto ? t('assistant.placeholder_reading') : t('assistant.placeholder_library')}
            className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-base md:text-sm resize-none outline-none focus:bg-white/10 transition-colors max-h-40"
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || pensando}
            aria-label={t('assistant.send')}
            className="p-3 max-md:w-12 max-md:h-12 max-md:grid max-md:place-items-center rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {!punto && (
          <div className="flex justify-center mt-3">
            <button
              onClick={() => setFuera(v => !v)}
              aria-pressed={fuera}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                fuera ? 'bg-red-600/30 text-red-200' : 'opacity-50 hover:opacity-80'
              }`}
            >
              <Compass className="w-3 h-3" /> {t('assistant.explore')}
            </button>
          </div>
        )}

        <p className="text-center text-[11px] opacity-40 mt-2">
          {fuera && !punto ? t('assistant.scope_explore') : (punto ? t('assistant.scope_reading') : t('assistant.scope_library'))}
        </p>
      </div>
  );
}
