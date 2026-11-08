import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export default function CapturasWeb({ capturas }) {
  const { t } = useI18n();
  const [abierta, setAbierta] = useState('');
  const validas = (capturas || []).filter(c => c && c.imagen);
  if (!validas.length) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-separator pt-3">
      {validas.map(c => (
        <figure key={c.imagen} className="space-y-1.5">
          <button type="button" onClick={() => setAbierta(a => (a === c.imagen ? '' : c.imagen))}
            aria-label={abierta === c.imagen ? t('assistant.capture.shrink') : t('assistant.capture.enlarge')}
            className="block w-full overflow-hidden rounded-xl ring-1 ring-border hover:ring-accent transition">
            <img src={c.imagen} alt={t('assistant.capture.alt', { titulo: c.titulo || c.url || '' })} loading="lazy"
              className={`w-full object-cover object-top ${abierta === c.imagen ? '' : 'max-h-48'}`} />
          </button>
          {/^https?:\/\//.test(c.url || '') && (
            <figcaption className="text-caption text-text-secondary truncate">
              <a href={c.url} onClick={e => { e.preventDefault(); window.api?.abrirEnNavegador?.(c.url); }}
                className="underline decoration-border">{c.titulo || c.url}</a>
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
