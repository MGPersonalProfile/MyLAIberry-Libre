import { useState } from 'react';
import { Check, X, PenLine, Plus } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { SegmentedControl } from '../ui/Controls';
import { CLASE_CAMPO } from '../ui/clases';

const TIPOS = ['preference', 'dislike'];

export default function Recuerdos({ memoria, accion, Accion, tarjeta }) {
  const { t } = useI18n();
  const [nuevo, setNuevo] = useState('');
  const [tipo, setTipo] = useState('preference');

  const anadir = async (e) => {
    e.preventDefault();
    if (!nuevo.trim()) return;

    const r = await accion('remember', { text: nuevo.trim(), kind: tipo, evidence: t('initiative.memory_by_hand') });
    if (r?.ok) setNuevo('');
  };

  return (
    <>
      {memoria.map(m => <Recuerdo key={m.id} m={m} accion={accion} Accion={Accion} tarjeta={tarjeta} />)}
      <form onSubmit={anadir} className={`${tarjeta} flex flex-wrap items-center gap-2`}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)} maxLength={300}
               placeholder={t('initiative.memory_add_placeholder')} aria-label={t('initiative.memory_add_placeholder')}
               className={`flex-1 min-w-40 ${CLASE_CAMPO}`} />
        <SegmentedControl value={tipo} onChange={setTipo} ariaLabel={t('initiative.memory')}
          options={TIPOS.map(k => ({ id: k, etiqueta: t(`initiative.kind_${k}`) }))} />
        <PrimaryButton type="submit" size="sm" icon={Plus} disabled={!nuevo.trim()}>{t('initiative.memory_add')}</PrimaryButton>
      </form>
    </>
  );
}

function Recuerdo({ m, accion, Accion, tarjeta }) {
  const { t } = useI18n();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(m.text);

  if (editando) {
    const guardar = async (e) => {
      e.preventDefault();
      if (texto.trim() && texto.trim() !== m.text) {
        const r = await accion('editMemory', { id: m.id, text: texto.trim(), status: 'confirmed' });
        if (!r?.ok) return;
      }
      setEditando(false);
    };
    return (
      <form onSubmit={guardar} className={`${tarjeta} flex items-center gap-2`}>
        <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus maxLength={300}
               aria-label={t('initiative.memory_edit')}
               onKeyDown={e => { if (e.key === 'Escape') { setTexto(m.text); setEditando(false); } }}
               className={`flex-1 ${CLASE_CAMPO}`} />
        <PrimaryButton type="submit" size="sm" icon={Check}>{t('initiative.memory_save')}</PrimaryButton>
        <SecondaryButton size="sm" onClick={() => { setTexto(m.text); setEditando(false); }}>{t('initiative.memory_cancel')}</SecondaryButton>
      </form>
    );
  }

  return (
    <div className={`${tarjeta} flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <p className="leading-snug">{m.text}</p>
        {m.kind === 'dislike' && <p className="text-caption text-text-secondary mt-0.5">{t('initiative.kind_dislike')}</p>}
        {m.status === 'proposed' && (
          <p className="text-caption text-warning mt-0.5">{t('initiative.proposed')}</p>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {m.status === 'proposed' && (
          <Accion onClick={() => accion('editMemory', { id: m.id, text: m.text, status: 'confirmed' })} icono={Check}>
            {t('initiative.confirm')}
          </Accion>
        )}
        <Accion onClick={() => { setTexto(m.text); setEditando(true); }} icono={PenLine}>
          {t('initiative.memory_edit')}
        </Accion>
        <Accion onClick={() => accion('forget', { id: m.id })} icono={X}>
          {t('initiative.forget')}
        </Accion>
      </div>
    </div>
  );
}
