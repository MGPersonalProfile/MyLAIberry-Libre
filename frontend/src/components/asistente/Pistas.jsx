import { useState } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function Pistas({ job, accion }) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [certeza, setCerteza] = useState('segura');
  const pistas = job.pistas || [];

  const anadir = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    const r = await accion('addClue', { id: job.id, text: texto.trim(), certeza });
    if (r?.ok) setTexto('');
  };

  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <button onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
              className="text-[11px] opacity-60 hover:opacity-100">
        {t('initiative.clues', { n: pistas.length })} · {abierto ? t('initiative.shelf_close') : t('initiative.clue_add')}
      </button>
      {abierto && (
        <>
          <ul className="mt-1.5 space-y-0.5">
            {pistas.map(p => (
              <li key={p.text} className="text-[12px] opacity-80">
                {p.text}{p.certeza === 'dudosa' && <span className="opacity-50"> · {t('initiative.clue_unsure')}</span>}
              </li>
            ))}
          </ul>
          <form onSubmit={anadir} className="mt-2 flex flex-wrap items-center gap-2">
            <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus maxLength={500}
                   placeholder={t('initiative.clue_placeholder')} aria-label={t('initiative.clue_add')}
                   className="flex-1 min-w-40 bg-transparent text-[12px] outline-none border-b border-white/20 focus:border-white/50 placeholder-gray-500" />
            <div className="flex gap-1">
              {['segura', 'dudosa'].map(c => (
                <button key={c} type="button" onClick={() => setCerteza(c)} aria-pressed={certeza === c}
                        className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${certeza === c ? 'bg-white/15 text-white' : 'bg-white/5 opacity-60 hover:opacity-100'}`}>
                  {t(c === 'segura' ? 'initiative.clue_sure' : 'initiative.clue_unsure')}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!texto.trim()}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors">
              <Plus className="w-3 h-3" /> {t('initiative.memory_add')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
