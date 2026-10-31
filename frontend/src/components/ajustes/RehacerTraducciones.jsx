import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, Check } from 'lucide-react';

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
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white font-medium">{t('settings.redo_title')}</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-lg">{t('settings.redo_desc')}</p>
        </div>
        <button onClick={() => setAbierta(true)}
                className="shrink-0 px-4 py-2 max-md:min-h-11 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:border-white/25 flex items-center gap-2 transition-colors">
          <RotateCcw className="w-4 h-4" /> {t('settings.redo_open')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white font-medium">{t('settings.redo_title')}</p>
          <button onClick={() => { setAbierta(false); setConfirmando(false); setAviso(null); }}
                  className="text-sm text-gray-400 hover:text-white max-md:min-h-11 px-2">{t('settings.redo_close')}</button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 focus-within:ring-1 focus-within:ring-white/20">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder={t('settings.redo_search')}
                 className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none" />
        </label>
      </div>

      {!obras ? (
        <p className="p-4 text-sm text-gray-600">{t('settings.loading')}</p>
      ) : obras.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">{t('settings.redo_empty')}</p>
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
            {visibles.length === 0 && <p className="p-4 text-sm text-gray-500">{t('settings.redo_none_match')}</p>}
          </div>
        </>
      )}

      <div className="p-4 border-t border-white/10">
        {aviso && (
          <p className={`text-xs mb-3 ${aviso.tipo === 'error' ? 'text-red-400' : 'text-gray-400'}`} role="status">{aviso.texto}</p>
        )}
        {confirmando ? (
          <div>
            <p className="text-xs text-gray-400 mb-3">{t('settings.redo_confirm', { n: elegidas.size })}</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={rehacer} disabled={trabajando}
                      className="px-4 py-2 max-md:min-h-11 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm text-white font-medium">
                {trabajando ? t('settings.redo_working') : t('settings.redo_yes')}
              </button>
              <button onClick={() => setConfirmando(false)} disabled={trabajando}
                      className="px-4 py-2 max-md:min-h-11 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5">
                {t('settings.redo_cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmando(true)} disabled={elegidas.size === 0}
                  className="px-4 py-2 max-md:min-h-11 rounded-lg border border-red-500/60 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent">
            {t('settings.redo_go', { n: elegidas.size })}
          </button>
        )}
      </div>
    </div>
  );
}

function Fila({ marcada, onClick, titulo, detalle, fuerte }) {
  return (
    <button onClick={onClick} role="checkbox" aria-checked={marcada}
            className="w-full min-h-11 px-4 py-2.5 flex items-center gap-3 text-left border-b border-white/5 last:border-b-0 hover:bg-white/[0.04]">
      <span className="flex-1 min-w-0">
        <span className={`block text-sm truncate ${fuerte ? 'text-white font-medium' : 'text-gray-200'}`}>{titulo}</span>
        {detalle && <span className="block text-xs text-gray-500 truncate">{detalle}</span>}
      </span>
      <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${marcada ? 'bg-red-600 border-red-600' : 'border-white/25'}`}>
        {marcada && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
