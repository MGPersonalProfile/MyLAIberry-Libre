import { useState } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import { Tag } from '../ui/Feedback';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
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
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('glossary.title')}
      </h3>
      <p className="text-footnote text-text-secondary mb-3">{t('glossary.help')}</p>
      <div className="flex flex-wrap gap-2">
        {glosario.map(g => (
          <Tag
            key={g.termino}
            onClick={() => alQuitar(g.termino)}
            title={t('glossary.remove')}
            className="group hover:border-destructive/50 hover:text-destructive max-md:min-h-11"
          >
            {g.accion === 'fijar' ? `${g.termino} → ${g.valor}` : g.termino}
            <X className="w-3 h-3 md:opacity-60 md:group-hover:opacity-100 transition-opacity" />
          </Tag>
        ))}
        {alAnadir && !abierto && (
          <Tag onClick={() => setAbierto(true)} className="border-dashed max-md:min-h-11">
            <Plus className="w-3 h-3" /> {t('glossary.add')}
          </Tag>
        )}
      </div>
      {abierto && (
        <form onSubmit={anadir} className="mt-3 flex flex-wrap items-center gap-2 max-w-lg">
          <input
            value={termino}
            onChange={e => setTermino(e.target.value)}
            autoFocus
            maxLength={80}
            placeholder={t('glossary.add_term')}
            aria-label={t('glossary.add_term')}
            onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}
            className="flex-1 min-w-32 bg-surface-secondary border border-border rounded-md px-3 py-1.5 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
          <input
            value={valor}
            onChange={e => setValor(e.target.value)}
            maxLength={80}
            placeholder={t('glossary.add_as')}
            aria-label={t('glossary.add_as')}
            onKeyDown={e => { if (e.key === 'Escape') setAbierto(false); }}
            className="flex-1 min-w-40 bg-surface-secondary border border-border rounded-md px-3 py-1.5 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
          <PrimaryButton type="submit" disabled={!termino.trim()}>
            {t('glossary.add_save')}
          </PrimaryButton>
        </form>
      )}
      {tocado && (
        <div className="mt-3">
          <SecondaryButton icon={RotateCcw} onClick={() => alRehacerTraducciones()}>
            {t('glossary.redo')}
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}
