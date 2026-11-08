import { useState } from 'react';
import { Check, X, PenLine, Plus, Undo2, ChevronDown, ChevronUp } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { CLASE_CAMPO } from '../ui/clases';

export default function Estanterias({ estanterias, deshacibles, accion, Accion, tarjeta }) {
  const { t } = useI18n();
  const [nueva, setNueva] = useState('');

  const crear = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;

    const r = await accion('createShelf', { name: nueva.trim() });
    if (r?.ok) setNueva('');
  };

  return (
    <>
      {estanterias.map(e => (
        <Estanteria key={e.id} e={e} accion={accion} Accion={Accion} tarjeta={tarjeta}
                    deshacer={deshacibles.filter(u => u.type === 'shelf' && u.shelfId === e.id).at(-1)} />
      ))}

      {deshacibles.filter(u => u.type === 'shelf' && u.borrada && !estanterias.some(e => e.id === u.shelfId)).map(u => (
        <div key={u.id} className={`${tarjeta} flex items-center justify-between gap-3 opacity-70`}>
          <p className="truncate line-through">{u.borrada.name}</p>
          <Accion onClick={() => accion('undoShelf', { id: u.id })} icono={Undo2}>{t('initiative.undo')}</Accion>
        </div>
      ))}
      <form onSubmit={crear} className={`${tarjeta} flex items-center gap-2`}>
        <input value={nueva} onChange={e => setNueva(e.target.value)} maxLength={100}
               placeholder={t('initiative.shelf_new_placeholder')} aria-label={t('initiative.shelf_new')}
               className={`flex-1 ${CLASE_CAMPO}`} />
        <PrimaryButton type="submit" size="sm" icon={Plus} disabled={!nueva.trim()}>{t('initiative.shelf_create')}</PrimaryButton>
      </form>
    </>
  );
}

function RenombrarEstanteria({ e, nombre, setNombre, accion, tarjeta, acabar }) {
  const { t } = useI18n();
  const cancelar = () => { setNombre(e.name); acabar(); };
  const guardar = async (ev) => {
    ev.preventDefault();
    if (nombre.trim() && nombre.trim() !== e.name) {
      const r = await accion('renameShelf', { id: e.id, name: nombre.trim() });
      if (!r?.ok) return;
    }
    acabar();
  };
  return (
    <form onSubmit={guardar} className={`${tarjeta} flex items-center gap-2`}>
      <input value={nombre} onChange={ev => setNombre(ev.target.value)} autoFocus maxLength={100}
             aria-label={t('initiative.shelf_rename')}
             onKeyDown={ev => { if (ev.key === 'Escape') cancelar(); }}
             className={`flex-1 ${CLASE_CAMPO}`} />
      <PrimaryButton type="submit" size="sm" icon={Check}>{t('initiative.memory_save')}</PrimaryButton>
      <SecondaryButton size="sm" onClick={cancelar}>{t('initiative.memory_cancel')}</SecondaryButton>
    </form>
  );
}

function Estanteria({ e, deshacer, accion, Accion, tarjeta }) {
  const { t } = useI18n();
  const [abierta, setAbierta] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(e.name);
  const obras = e.obras || e.ids.map(id => ({ id, title: null }));

  if (renombrando) {
    return <RenombrarEstanteria e={e} nombre={nombre} setNombre={setNombre} accion={accion} tarjeta={tarjeta}
                                acabar={() => setRenombrando(false)} />;
  }

  return (
    <div className={tarjeta} data-estanteria={e.id}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setAbierta(a => !a)} aria-expanded={abierta}
                className="min-w-0 text-left flex-1" title={abierta ? t('initiative.shelf_close') : t('initiative.shelf_open')}>
          <p className="truncate flex items-center gap-1.5">
            {e.name}
            {abierta ? <ChevronUp className="w-3 h-3 text-text-tertiary shrink-0" /> : <ChevronDown className="w-3 h-3 text-text-tertiary shrink-0" />}
          </p>
          <p className="text-caption text-text-secondary mt-0.5">{t('initiative.shelf_works', { n: e.ids?.length || 0 })}</p>
        </button>
        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
          {deshacer && <Accion onClick={() => accion('undoShelf', { id: deshacer.id })} icono={Undo2}>{t('initiative.undo')}</Accion>}
          <Accion onClick={() => { setNombre(e.name); setRenombrando(true); }} icono={PenLine}>{t('initiative.shelf_rename')}</Accion>
          <Accion onClick={() => accion('deleteShelf', { id: e.id })} icono={X}>{t('initiative.shelf_delete')}</Accion>
        </div>
      </div>
      {abierta && (
        <ul className="mt-2 space-y-1 border-t border-separator pt-2">
          {!obras.length && <li className="text-caption text-text-secondary">{t('initiative.shelf_empty')}</li>}
          {obras.map(o => (
            <li key={o.id} className="flex items-center justify-between gap-3">
              <span className={`truncate ${o.title ? '' : 'text-text-tertiary italic'}`}>{o.title || t('initiative.shelf_gone')}</span>
              <Accion onClick={() => accion('shelfWorks', { id: e.id, remove: [o.id] })} icono={X}>{t('initiative.shelf_take_out')}</Accion>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
