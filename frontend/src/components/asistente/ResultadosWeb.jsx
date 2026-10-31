import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

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
    {!!obras?.length && <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      {obras.filter(o => /^https?:\/\//.test(o.url)).slice(0, 20).map(o => <div key={o.url}
        className="flex items-center justify-between gap-3 text-xs">
        <a href={o.url} onClick={e => { e.preventDefault(); window.api?.abrirEnNavegador?.(o.url); }}
          className="min-w-0 truncate text-gray-300 underline decoration-white/20">{o.titulo}</a>
        <button type="button" disabled={!!importando || agregadas.has(o.url)} onClick={() => importar(o.url)}
          className="shrink-0 rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-40">
          {importando === o.url ? t('assistant.research.importing') : agregadas.has(o.url) ? t('assistant.research.added') : t('assistant.research.add')}
        </button>
      </div>)}
      {error && <p role="alert" className="text-amber-400">{error}</p>}
    </div>}
    {coste && <p className="mt-2 text-[11px] opacity-60">
      {t('assistant.research.cost', { usd: coste.usd.toFixed(6), tokens: coste.input + coste.output })}
    </p>}
  </>;
}
