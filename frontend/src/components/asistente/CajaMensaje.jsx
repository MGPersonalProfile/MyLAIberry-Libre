import { Send, Compass } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton } from '../ui/Buttons';
import { Tag } from '../ui/Feedback';

export default function CajaMensaje({ texto, setTexto, pensando, punto, fuera, setFuera, enviar }) {
  const { t } = useI18n();
  return (
      <div className="border-t border-separator p-3 md:p-4">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}

            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
            }}
            rows={1}
            placeholder={punto ? t('assistant.placeholder_reading') : t('assistant.placeholder_library')}
            className="flex-1 min-w-0 rounded-md bg-surface-secondary border border-border/60 px-3.5 py-2.5 min-h-[var(--control-search-h)] text-base md:text-body text-text-primary placeholder:text-text-secondary resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-all duration-150 max-h-40"
          />
          <PrimaryButton icon={Send} onClick={enviar} disabled={!texto.trim() || pensando} aria-label={t('assistant.send')} className="!px-0 w-[var(--control-btn-h)] shrink-0" />
        </div>

        {!punto && (
          <div className="flex justify-center mt-3">
            <Tag active={fuera} onClick={() => setFuera(v => !v)}><Compass className="w-3 h-3" /> {t('assistant.explore')}</Tag>
          </div>
        )}

        <p className="text-center text-caption text-text-tertiary mt-2">
          {fuera && !punto ? t('assistant.scope_explore') : (punto ? t('assistant.scope_reading') : t('assistant.scope_library'))}
        </p>
      </div>
  );
}
