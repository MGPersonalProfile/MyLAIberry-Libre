import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Tag } from '../ui/Feedback';
import { PrimaryButton } from '../ui/Buttons';
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
      <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {t('shelves.title')}
      </h3>
      {estanterias.length > 0 && (
        <p className="text-footnote text-text-secondary mb-3">{t('shelves.help')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {estanterias.map(e => {
          const dentro = e.ids.map(String).includes(id);
          return (
            <Tag
              key={e.id}
              active={dentro}
              onClick={() => accion('shelfWorks', { id: e.id, [dentro ? 'remove' : 'add']: [obraId] })}
              className="max-md:min-h-11"
            >
              {dentro && <Check className="w-3 h-3" />}
              {e.name}
            </Tag>
          );
        })}
        {!abierto && (
          <Tag onClick={() => setAbierto(true)} className="border-dashed max-md:min-h-11">
            <Plus className="w-3 h-3" /> {t('shelves.new')}
          </Tag>
        )}
      </div>
      {abierto && (
        <form onSubmit={crear} className="mt-3 flex items-center gap-2 max-w-sm">
          <input
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            autoFocus
            maxLength={100}
            placeholder={t('shelves.new_placeholder')}
            aria-label={t('shelves.new')}
            onKeyDown={e => { if (e.key === 'Escape') { setNueva(''); setAbierto(false); } }}
            className="flex-1 min-w-0 bg-surface-secondary border border-border rounded-md px-3 py-1.5 text-small text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
          <PrimaryButton type="submit" disabled={!nueva.trim()}>
            {t('shelves.create')}
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}
