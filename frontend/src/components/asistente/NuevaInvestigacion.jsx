import { useState } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function NuevaInvestigacion({ accion, tarjeta }) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('search');
  const [pistas, setPistas] = useState('');

  const crear = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    const lista = pistas.split('\n').map(p => p.trim()).filter(Boolean).map(text => ({ text, certeza: 'segura' }));
    const r = await accion('createInvestigation', { query: query.trim(), kind, pistas: kind === 'lost' ? lista : [] });
    if (r?.ok) { setQuery(''); setPistas(''); setAbierto(false); }
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <Plus className="w-3 h-3" /> {t('initiative.research_new')}
      </button>
    );
  }
  return (
    <form onSubmit={crear} className={`${tarjeta} space-y-2`} data-nueva-investigacion>
      <div className="flex gap-1">
        {['search', 'lost'].map(k => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                  className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${kind === k ? 'bg-white/15 text-white' : 'bg-white/5 opacity-60 hover:opacity-100'}`}>
            {t(k === 'search' ? 'initiative.research_kind_search' : 'initiative.research_kind_lost')}
          </button>
        ))}
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} autoFocus maxLength={120}
             placeholder={t('initiative.research_query')} aria-label={t('initiative.research_query')}
             className="w-full bg-transparent outline-none border-b border-white/20 focus:border-white/50 placeholder-gray-500" />
      {kind === 'lost' && (
        <textarea value={pistas} onChange={e => setPistas(e.target.value)} rows={3} maxLength={4000}
                  placeholder={t('initiative.research_clues')} aria-label={t('initiative.research_clues')}
                  className="w-full bg-transparent text-[12px] outline-none border border-white/10 rounded-lg p-2 focus:border-white/30 placeholder-gray-500" />
      )}
      <div className="flex gap-1.5">
        <button type="submit" disabled={!query.trim() || (kind === 'lost' && !pistas.trim())}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40">
          <Plus className="w-3 h-3" /> {t('initiative.research_create')}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-[11px] px-2 py-1 rounded-lg opacity-60 hover:opacity-100">
          {t('initiative.memory_cancel')}
        </button>
      </div>
    </form>
  );
}
