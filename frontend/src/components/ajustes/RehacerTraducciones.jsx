import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';

import { DialogSheet } from '../ui/Layout';
import { SearchField } from '../ui/Controls';
import { SecondaryButton, DestructiveButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function RehacerTraducciones({ onHecho }) {
  const { t } = useI18n();
  const [abierta, setAbierta] = useState(false);
  const [obras, setObras] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [elegidas, setElegidas] = useState(() => new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!abierta || obras) return;
    let vivo = true;
    window.api.getLibrary().then(lista => {
      if (!vivo) return;
      setObras([...(lista || [])].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' })));
    }).catch(err => vivo && setAviso({ tipo: 'error', texto: err?.message }));
    return () => { vivo = false; };
  }, [abierta, obras]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!obras) return [];
    return q ? obras.filter(o => `${o.title || ''} ${o.author || ''}`.toLowerCase().includes(q)) : obras;
  }, [obras, filtro]);

  const todas = obras && obras.length > 0 && elegidas.size === obras.length;
  const cambiar = id => {
    setConfirmando(false);
    setElegidas(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };
  const alternarTodas = () => {
    setConfirmando(false);
    setElegidas(todas ? new Set() : new Set(obras.map(o => String(o.id))));
  };

  const rehacer = async () => {
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await window.api.redoTranslationsMany([...elegidas]);
      if (r?.status !== 'ok') throw new Error(r?.message || t('settings.redo_failed'));
      setAviso({ tipo: 'ok', texto: t('settings.redo_done', { obras: r.obras, n: r.borradas }) });
      setElegidas(new Set());
      onHecho?.();
    } catch (err) {
      setAviso({ tipo: 'error', texto: err?.message || t('settings.redo_failed') });
    } finally {
      setTrabajando(false);
      setConfirmando(false);
    }
  };

  if (!window.api?.redoTranslationsMany) return null;

  if (!abierta) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-callout text-text-primary font-medium">{t('settings.redo_title')}</p>
          <p className="text-footnote text-text-secondary mt-0.5 max-w-lg">{t('settings.redo_desc')}</p>
        </div>
        <SecondaryButton onClick={() => setAbierta(true)} icon={RotateCcw} className="shrink-0">
          {t('settings.redo_open')}
        </SecondaryButton>
      </div>
    );
  }

  return (
    <DialogSheet
      inline
      title={t('settings.redo_title')}
      onClose={() => { setAbierta(false); setConfirmando(false); setAviso(null); }}
      closeLabel={t('settings.redo_close')}
      footer={
        <div>
          {aviso && (
            <Notice tone={aviso.tipo === 'error' ? 'danger' : 'info'} className="mb-3">{aviso.texto}</Notice>
          )}
          {confirmando ? (
            <div>
              <p className="text-footnote text-text-secondary mb-3">{t('settings.redo_confirm', { n: elegidas.size })}</p>
              <div className="flex gap-2 flex-wrap">
                <DestructiveButton onClick={rehacer} disabled={trabajando}>
                  {trabajando ? t('settings.redo_working') : t('settings.redo_yes')}
                </DestructiveButton>
                <SecondaryButton onClick={() => setConfirmando(false)} disabled={trabajando}>
                  {t('settings.redo_cancel')}
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <DestructiveButton onClick={() => setConfirmando(true)} disabled={elegidas.size === 0}>
              {t('settings.redo_go', { n: elegidas.size })}
            </DestructiveButton>
          )}
        </div>
      }
    >
      <div className="p-4 border-b border-border/60">
        <SearchField
          value={filtro}
          onChange={setFiltro}
          placeholder={t('settings.redo_search')}
        />
      </div>

      {!obras ? (
        <p className="p-4 text-callout text-text-tertiary">{t('settings.loading')}</p>
      ) : obras.length === 0 ? (
        <p className="p-4 text-callout text-text-secondary">{t('settings.redo_empty')}</p>
      ) : (
        <>
          {!filtro.trim() && (
            <Fila marcada={todas} onClick={alternarTodas}
                  titulo={t('settings.redo_all', { n: obras.length })} fuerte />
          )}
          <div className="max-h-72 overflow-y-auto overscroll-contain">
            {visibles.map(o => (
              <Fila key={o.id} marcada={elegidas.has(String(o.id))} onClick={() => cambiar(String(o.id))}
                    titulo={o.title} detalle={o.author} />
            ))}
            {visibles.length === 0 && <p className="p-4 text-callout text-text-secondary">{t('settings.redo_none_match')}</p>}
          </div>
        </>
      )}
    </DialogSheet>
  );
}

function Fila({ marcada, onClick, titulo, detalle, fuerte }) {
  return (
    <button onClick={onClick} role="checkbox" aria-checked={marcada}
            className="w-full min-h-11 px-4 py-2.5 flex items-center gap-3 text-left border-b border-border/40 last:border-b-0 hover:bg-surface-tertiary/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
      <span className="flex-1 min-w-0">
        <span className={`block text-callout truncate ${fuerte ? 'text-text-primary font-medium' : 'text-text-primary'}`}>{titulo}</span>
        {detalle && <span className="block text-footnote text-text-secondary truncate">{detalle}</span>}
      </span>
      <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${marcada ? 'bg-accent border-accent' : 'border-border'}`}>
        {marcada && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
