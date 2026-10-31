import { useState } from 'react';
import { Check, Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function EstanteriasDeLaObra({ obraId, estanterias, accion }) {
  const { t } = useI18n();
  const [nueva, setNueva] = useState('');
  const [abierto, setAbierto] = useState(false);
  const id = String(obraId);

  const crear = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    const r = await accion('createShelf', { name: nueva.trim(), ids: [obraId] });
    if (r?.ok) { setNueva(''); setAbierto(false); }
  };

  return (
    <div className="mt-6" data-estanterias-obra>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('shelves.title')}</h3>
      {estanterias.length > 0 && <p className="text-xs text-gray-600 mb-3">{t('shelves.help')}</p>}
      <div className="flex flex-wrap gap-2">
        {estanterias.map(e => {
          const dentro = e.ids.map(String).includes(id);
          return (
            <button key={e.id} aria-pressed={dentro}
                    onClick={() => accion('shelfWorks', { id: e.id, [dentro ? 'remove' : 'add']: [obraId] })}
                    className={`px-3 py-1 rounded-full border text-xs flex items-center gap-1.5 transition-colors ${dentro
                      ? 'border-white/40 bg-white/10 text-white' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-gray-200'}`}>
              {dentro && <Check className="w-3 h-3" />}{e.name}
            </button>
          );
        })}
        {!abierto && (
          <button onClick={() => setAbierto(true)}
                  className="px-3 py-1 rounded-full border border-dashed border-white/15 text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> {t('shelves.new')}
          </button>
        )}
      </div>
      {abierto && (
        <form onSubmit={crear} className="mt-3 flex items-center gap-2 max-w-sm">
          <input value={nueva} onChange={e => setNueva(e.target.value)} autoFocus maxLength={100}
                 placeholder={t('shelves.new_placeholder')} aria-label={t('shelves.new')}
                 onKeyDown={e => { if (e.key === 'Escape') { setNueva(''); setAbierto(false); } }}
                 className="flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-white/20 focus:border-white/50 placeholder-gray-600" />
          <button type="submit" disabled={!nueva.trim()}
                  className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-40">
            {t('shelves.create')}
          </button>
        </form>
      )}
    </div>
  );
}
