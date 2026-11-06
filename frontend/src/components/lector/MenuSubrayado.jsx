import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Highlighter, Image, MessageSquarePlus, Trash2 } from 'lucide-react';
import { PrimaryButton, DestructiveButton, SecondaryButton } from '../ui/Buttons';
import { useI18n } from '../../i18n/I18nContext';
import { COLORES } from './subrayadoDom';
import useSubrayados from '../../hooks/useSubrayados';
import { copiarCita, guardarTarjeta } from './exportarTarjeta';

const TONO = { amarillo: '#f5d547', verde: '#6fcf7f', azul: '#5aa9f0', rosa: '#f08fb8', naranja: '#f2a04a' };

function Colores({ actual, alElegir, t }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('hl.color')}>
      {COLORES.map(c => (
        <button key={c} type="button" onMouseDown={e => e.preventDefault()} onClick={() => alElegir(c)}
          aria-label={t(`hl.color.${c}`)} aria-pressed={actual === c} data-color={c}
          className={`w-9 h-9 md:w-7 md:h-7 rounded-full border-2 ${actual === c ? 'border-text-primary' : 'border-transparent'}`}
          style={{ background: TONO[c] }} />
      ))}
    </div>
  );
}

const caja = 'fixed z-[260] rounded-lg bg-surface-secondary border border-border shadow-xl p-2';
const dentro = (x, ancho) => Math.min(Math.max(8, x - ancho / 2), window.innerWidth - ancho - 8);

function MenuDeSeleccion({ seleccion, marcar, t }) {
  const arriba = seleccion.arriba > 64;
  return (
    <div className={`${caja} flex items-center gap-2`} data-menu-subrayado="seleccion" role="toolbar"
      style={{ left: dentro(seleccion.x, 300), top: arriba ? seleccion.arriba - 52 : seleccion.abajo + 8 }}>
      <Highlighter className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
      <Colores actual={null} alElegir={c => marcar(c, 'subrayado')} t={t} />
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => marcar('amarillo', 'nota')}
        aria-label={t('hl.note')} title={t('hl.note')}
        className="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-md hover:bg-surface-hover text-text-primary">
        <MessageSquarePlus className="w-4 h-4" />
      </button>
    </div>
  );
}

function Conflicto({ anotacion, resolver, t }) {
  const { op, actual } = anotacion.conflicto;
  const mia = op.cambios?.nota ?? '', suya = actual?.eliminado ? t('hl.deleted_elsewhere') : (actual?.nota ?? '');
  return (
    <div className="space-y-2" data-conflicto role="alert">
      <p className="text-small font-semibold text-destructive">{t('hl.conflict')}</p>
      <p className="text-small"><span className="text-text-secondary">{t('hl.conflict_mine')}: </span>{mia || '—'}</p>
      <p className="text-small"><span className="text-text-secondary">{t('hl.conflict_theirs')}: </span>{suya || '—'}</p>
      <div className="flex gap-2">
        <SecondaryButton size="sm" onClick={() => resolver(anotacion.id, 'servidor')} data-accion="conservar-servidor">
          {t('hl.keep_theirs')}
        </SecondaryButton>
        <PrimaryButton size="sm" onClick={() => resolver(anotacion.id, 'mia')} data-accion="conservar-mia">
          {t('hl.keep_mine')}
        </PrimaryButton>
      </div>
    </div>
  );
}

function Tarjeta({ anotacion, obra, capitulo, t }) {
  const [conNota, setConNota] = useState(false);
  const [aviso, setAviso] = useState('');
  const dato = { anotacion, obra, capitulo };
  const hacer = async fn => { setAviso(''); try { const r = await fn(); if (r?.ok === false) setAviso(t('hl.card_long')); } catch { setAviso(t('hl.card_error')); } };
  return (
    <div className="space-y-1" data-tarjeta>
      {anotacion.nota && (
        <label className="flex items-center gap-2 text-small text-text-secondary">
          <input type="checkbox" checked={conNota} onChange={e => setConNota(e.target.checked)} data-campo-con-nota />
          {t('hl.card_with_note')}
        </label>
      )}
      <div className="flex gap-2">
        <SecondaryButton size="sm" icon={Copy} data-accion="copiar-cita"
          onClick={() => hacer(() => copiarCita(dato.anotacion, dato.obra, dato.capitulo, conNota))}>{t('hl.copy')}</SecondaryButton>
        <SecondaryButton size="sm" icon={Image} data-accion="guardar-tarjeta"
          onClick={() => hacer(() => guardarTarjeta(dato.anotacion, dato.obra, dato.capitulo, { incluirNota: conNota }))}>{t('hl.card')}</SecondaryButton>
      </div>
      {aviso && <p className="text-small text-destructive" role="status">{aviso}</p>}
    </div>
  );
}

function Anotacion({ anotacion, punto, editar, borrar, cerrar, resolver, obra, capitulo, t }) {
  const [nota, setNota] = useState(anotacion.nota || '');
  const cambio = nota !== (anotacion.nota || '');
  return (
    <div className={`${caja} w-[300px] space-y-2`} data-menu-subrayado="anotacion" role="dialog"
      aria-label={t('hl.edit')} style={{ left: dentro(punto.x, 300), top: Math.min(punto.y + 12, window.innerHeight - 240) }}>
      <p className="text-small text-text-secondary line-clamp-3 italic">«{anotacion.ancla.cita}»</p>
      {anotacion.conflicto && <Conflicto anotacion={anotacion} resolver={resolver} t={t} />}
      {!anotacion.conflicto && <Tarjeta anotacion={anotacion} obra={obra} capitulo={capitulo} t={t} />}
      <Colores actual={anotacion.color} alElegir={c => editar(anotacion.id, { color: c })} t={t} />
      <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} maxLength={4000}
        placeholder={t('hl.note_placeholder')} aria-label={t('hl.note')} data-campo-nota
        className="w-full rounded-md bg-surface-primary border border-border p-2 text-body text-text-primary" />
      <div className="flex items-center justify-between gap-2">
        <DestructiveButton size="sm" icon={Trash2} onClick={() => borrar(anotacion.id)} data-accion="borrar">
          {t('hl.delete')}
        </DestructiveButton>
        <div className="flex gap-2">
          <SecondaryButton size="sm" onClick={cerrar}>{t('hl.close')}</SecondaryButton>
          <PrimaryButton size="sm" disabled={!cambio} data-accion="guardar-nota"
            onClick={() => editar(anotacion.id, { nota, tipo: nota.trim() ? 'nota' : 'subrayado' })}>
            {t('hl.save')}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default function MenuSubrayado({ scrollRef, story, capitulo, variante, claves }) {
  const obra = story;
  const { t } = useI18n();
  const sub = useSubrayados({ scrollRef, obra: story.id, capitulo, variante, claves });
  const viva = sub.abierta && sub.anotaciones.find(a => a.id === sub.abierta.id);
  const contenido = sub.seleccion
    ? <MenuDeSeleccion seleccion={sub.seleccion} marcar={sub.marcar} t={t} />
    : viva && <Anotacion key={`${viva.id}:${viva.revision}`} anotacion={viva} punto={sub.abierta} editar={sub.editar} borrar={sub.borrar} cerrar={sub.cerrar} resolver={sub.resolver} obra={obra} capitulo={capitulo} t={t} />;
  return contenido ? createPortal(contenido, document.body) : null;
}
