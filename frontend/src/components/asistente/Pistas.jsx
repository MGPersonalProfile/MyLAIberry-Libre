import { useState } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { CLASE_CAMPO } from '../ui/clases';

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
    <div className="mt-2 border-t border-separator pt-2">
      <SecondaryButton size="sm" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>
        {t('initiative.clues', { n: pistas.length })} · {abierto ? t('initiative.shelf_close') : t('initiative.clue_add')}
      </SecondaryButton>
      {abierto && (
        <>
          <ul className="mt-1.5 space-y-0.5">
            {pistas.map(p => (
              <li key={p.text} className="text-footnote text-text-secondary">
                {p.text}{p.certeza === 'dudosa' && <span className="text-text-tertiary"> · {t('initiative.clue_unsure')}</span>}
              </li>
            ))}
          </ul>
          <form onSubmit={anadir} className="mt-2 flex flex-wrap items-center gap-2">
            <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus maxLength={500}
                   placeholder={t('initiative.clue_placeholder')} aria-label={t('initiative.clue_add')}
                   className={`flex-1 min-w-40 ${CLASE_CAMPO}`} />
            <SegmentedControl value={certeza} onChange={setCerteza} ariaLabel={t('initiative.clues', { n: pistas.length })} options={[
              { id: 'segura', etiqueta: t('initiative.clue_sure') },
              { id: 'dudosa', etiqueta: t('initiative.clue_unsure') }
            ]} />
            <PrimaryButton type="submit" size="sm" icon={Plus} disabled={!texto.trim()}>{t('initiative.memory_add')}</PrimaryButton>
          </form>
        </>
      )}
    </div>
  );
}
