import { useState } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { CLASE_CAMPO } from '../ui/clases';

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
    return <SecondaryButton size="sm" icon={Plus} onClick={() => setAbierto(true)}>{t('initiative.research_new')}</SecondaryButton>;
  }
  return (
    <form onSubmit={crear} className={`${tarjeta} space-y-3`} data-nueva-investigacion>
      <SegmentedControl value={kind} onChange={setKind} ariaLabel={t('initiative.research_new')} options={[
        { id: 'search', etiqueta: t('initiative.research_kind_search') },
        { id: 'lost', etiqueta: t('initiative.research_kind_lost') }
      ]} />
      <input value={query} onChange={e => setQuery(e.target.value)} autoFocus maxLength={120}
             placeholder={t('initiative.research_query')} aria-label={t('initiative.research_query')}
             className={`w-full ${CLASE_CAMPO}`} />
      {kind === 'lost' && (
        <textarea value={pistas} onChange={e => setPistas(e.target.value)} rows={3} maxLength={4000}
                  placeholder={t('initiative.research_clues')} aria-label={t('initiative.research_clues')}
                  className={`w-full py-2 ${CLASE_CAMPO}`} />
      )}
      <div className="flex gap-2">
        <PrimaryButton type="submit" size="sm" icon={Plus} disabled={!query.trim() || (kind === 'lost' && !pistas.trim())}>
          {t('initiative.research_create')}
        </PrimaryButton>
        <SecondaryButton size="sm" onClick={() => setAbierto(false)}>{t('initiative.memory_cancel')}</SecondaryButton>
      </div>
    </form>
  );
}
