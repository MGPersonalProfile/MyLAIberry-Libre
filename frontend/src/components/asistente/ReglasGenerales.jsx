import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function ReglasGenerales({ reglas, accion, Accion, tarjeta }) {
  const { t } = useI18n();
  const [termino, setTermino] = useState('');
  const [valor, setValor] = useState('');
  const generales = reglas.filter(r => r.workId === 'global');

  const anadir = async (e) => {
    e.preventDefault();
    if (!termino.trim()) return;
    const r = await accion('addGlobalRule', { termino: termino.trim(), valor: valor.trim() });
    if (r?.ok) { setTermino(''); setValor(''); }
  };

  return (
    <>
      {generales.map(r => (
        <div key={r.id || r.text} className={`${tarjeta} flex items-center justify-between gap-3`}>
          <p className="leading-snug">{r.text}</p>
          {r.id && <Accion onClick={() => accion('removeRule', { id: r.id })} icono={X}>{t('initiative.rule_remove')}</Accion>}
        </div>
      ))}
      <form onSubmit={anadir} className={`${tarjeta} flex flex-wrap items-center gap-2`} data-regla-general>
        <input value={termino} onChange={e => setTermino(e.target.value)} maxLength={60}
               placeholder={t('initiative.rule_term')} aria-label={t('initiative.rule_term')}
               className="flex-1 min-w-28 bg-transparent outline-none placeholder-gray-500" />
        <input value={valor} onChange={e => setValor(e.target.value)} maxLength={60}
               placeholder={t('initiative.rule_value')} aria-label={t('initiative.rule_value')}
               className="flex-1 min-w-36 bg-transparent outline-none placeholder-gray-500" />
        <button type="submit" disabled={!termino.trim()}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors">
          <Plus className="w-3 h-3" /> {t('initiative.memory_add')}
        </button>
      </form>
    </>
  );
}
