import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';

export default function ResultadosWeb({ obras, coste }) {
  const { t } = useI18n();
  const [importando, setImportando] = useState('');
  const [agregadas, setAgregadas] = useState(() => new Set());
  const [error, setError] = useState('');
  const importar = async url => {
    setImportando(url); setError('');
    try {
      const r = await window.api.importarEnlaceLibro(url);
      if (r?.status === 'error') throw new Error(r.message);
      setAgregadas(viejas => new Set([...viejas, url]));
    } catch (e) { setError(e.message); }
    finally { setImportando(''); }
  };
  return <>
    {!!obras?.length && <div className="mt-3 space-y-2 border-t border-separator pt-3">
      {obras.filter(o => /^https?:\/\//.test(o.url)).slice(0, 20).map(o => <div key={o.url}
        className="flex items-center justify-between gap-3 text-xs">
        <a href={o.url} onClick={e => { e.preventDefault(); window.api?.abrirEnNavegador?.(o.url); }}
          className="min-w-0 truncate text-text-primary underline decoration-border">{o.titulo}</a>
        <SecondaryButton size="sm" disabled={!!importando || agregadas.has(o.url)} onClick={() => importar(o.url)} className="shrink-0">
          {importando === o.url ? t('assistant.research.importing') : agregadas.has(o.url) ? t('assistant.research.added') : t('assistant.research.add')}
        </SecondaryButton>
      </div>)}
      {error && <Notice tone="warning" compact>{error}</Notice>}
    </div>}
    {coste && <p className="mt-2 text-caption text-text-secondary">
      {t('assistant.research.cost', { usd: coste.usd.toFixed(6), tokens: coste.input + coste.output })}
    </p>}
  </>;
}
