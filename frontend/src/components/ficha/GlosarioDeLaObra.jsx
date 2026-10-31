import { useState } from 'react';
import { X, Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function GlosarioDeLaObra({ glosario, tocado, alQuitar, alAnadir, alRehacerTraducciones }) {
  const { t } = useI18n();

  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState('');
  const [valor, setValor] = useState('');
  const anadir = async (e) => {
    e.preventDefault();
    if (!termino.trim()) return;
    try {
      await alAnadir(termino.trim(), valor.trim());
      setTermino(''); setValor(''); setAbierto(false);
    } catch {  }
  };
  return (
      <div className="mt-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t('glossary.title')}
        </h3>
        <p className="text-xs text-gray-600 mb-3">{t('glossary.help')}</p>
        <div className="flex flex-wrap gap-2">
          {glosario.map(g => (
            <button
              key={g.termino}
              onClick={() => alQuitar(g.termino)}
              title={t('glossary.remove')}
              className="group px-3 py-1 rounded-full border border-white/15 text-xs text-gray-300 hover:border-red-500/50 hover:text-red-400 transition-colors flex items-center gap-1.5"
            >
              {g.accion === 'fijar' ? `${g.termino} → ${g.valor}` : g.termino}
              <X className="w-3 h-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
          {alAnadir && !abierto && (
            <button onClick={() => setAbierto(true)}
                    className="px-3 py-1 rounded-full border border-dashed border-white/15 text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t('glossary.add')}
            </button>
          )}
        </div>
        {abierto && (
          <form onSubmit={anadir} className="mt-3 flex flex-wrap items-center gap-2 max-w-lg">
            <input value={termino} onChange={e => setTermino(e.target.value)} autoFocus maxLength={80}
                   placeholder={t('glossary.add_term')} aria-label={t('glossary.add_term')}
                   onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}
                   className="flex-1 min-w-32 bg-transparent text-sm outline-none border-b border-white/20 focus:border-white/50 placeholder-gray-600" />
            <input value={valor} onChange={e => setValor(e.target.value)} maxLength={80}
                   placeholder={t('glossary.add_as')} aria-label={t('glossary.add_as')}
                   onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}
                   className="flex-1 min-w-40 bg-transparent text-sm outline-none border-b border-white/20 focus:border-white/50 placeholder-gray-600" />
            <button type="submit" disabled={!termino.trim()}
                    className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-40">
              {t('glossary.add_save')}
            </button>
          </form>
        )}
        {tocado && (
          <button
            onClick={() => alRehacerTraducciones()}
            className="mt-3 text-xs text-amber-400/90 hover:text-amber-300 underline underline-offset-2"
          >
            {t('glossary.redo')}
          </button>
        )}
      </div>
  );
}
