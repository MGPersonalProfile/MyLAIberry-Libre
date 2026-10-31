import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export default function Preferencias({ alCambiar }) {
  const { t } = useI18n();
  const [datos, setDatos] = useState(null);
  const [fandom, setFandom] = useState('');
  const [autor, setAutor] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    let vivo = true;
    window.api.getDiscoveryPreferences?.().then(d => { if (vivo) setDatos(d); })
      .catch(e => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, []);
  async function decidir(opciones) {
    setOcupado(true); setError(''); setAviso('');
    try {
      const r = await window.api.decidirDescubrimientos(opciones);
      if (r?.status !== 'ok') throw new Error(r?.message || t('discover.preferences_error'));
      setDatos(await window.api.getDiscoveryPreferences());
      setConfirmar(false);
      setAviso(t('discover.preferences_saved', { n: r.descartadas }));
      await alCambiar?.();
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  const clase = 'bg-[#202020] rounded-lg p-2 text-sm min-w-0';

  const ocultas = datos?.totalOcultas || 0;
  const porQue = ['formato', 'autores', 'fandoms'].filter(k => datos?.ocultasPor?.[k])
    .map(k => t({ formato: 'discover.hidden_format', autores: 'discover.hidden_authors', fandoms: 'discover.hidden_fandoms' }[k], { n: datos.ocultasPor[k] }))
    .join(', ');
  const aCero = !!datos && datos.totalVisibles === 0 && ocultas > 0;
  return <>{ocultas > 0 && <p role="status" data-ocultas-por-filtros className={`mb-2 text-sm ${aCero ? 'text-amber-300' : 'text-gray-500'}`}>
    {t(ocultas === 1 ? 'discover.hidden_by_filters_one' : 'discover.hidden_by_filters', { n: ocultas, detalle: porQue })}</p>}
  <details open={aCero || undefined} className="mb-5 rounded-xl border border-white/10 p-3 text-sm">
    <summary className="cursor-pointer">{t('discover.preferences')}</summary>
    <p className="text-gray-400 my-3">{t('discover.preferences_hint')}</p>
    {datos && <fieldset disabled={ocupado} className="space-y-3 disabled:opacity-50">
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('discover.fandom')} value={fandom} onChange={e => { setFandom(e.target.value); setConfirmar(false); }} className={clase}>
          <option value="">{t('discover.fandom')}</option>
          {datos.fandoms.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
        </select>
        <button disabled={!fandom} className={clase} onClick={() => setConfirmar(true)}>{t('discover.discard_fandom')}</button>
        <button disabled={!fandom} className={clase} onClick={() => decidir({ accion: 'ocultarFandom', fandom })}>{t('discover.hide_fandom')}</button>
      </div>
      {confirmar && <div role="alert" className="flex flex-wrap gap-2 items-center">
        <span>{t('discover.discard_question', { fandom })}</span>
        <button className={clase} onClick={() => decidir({ accion: 'descartarFandom', fandom })}>{t('discover.discard_fandom')}</button>
        <button className={clase} onClick={() => setConfirmar(false)}>{t('common.cancel')}</button>
      </div>}
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('discover.author')} value={autor} onChange={e => setAutor(e.target.value)} className={clase}>
          <option value="">{t('discover.author')}</option>
          {datos.autores.map(a => <option key={a.clave} value={a.clave}>{a.nombre} · {a.fuente} ({a.cuantas})</option>)}
        </select>
        <button disabled={!autor} className={clase} onClick={() => decidir({ accion: 'bloquearAutor', autor })}>{t('discover.block_author')}</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label={t('discover.min_words')} className={clase} value={datos.preferencias.formato?.minPalabras || 0}
          onChange={e => decidir({ accion: 'formato', minPalabras: Number(e.target.value), minCapitulos: datos.preferencias.formato?.minCapitulos || 0 })}>
          {[0, 10000, 20000, 50000, 100000].map(n => <option key={n} value={n}>{n ? t('discover.min_words_n', { n: n.toLocaleString() }) : t('discover.min_words_none')}</option>)}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={(datos.preferencias.formato?.minCapitulos || 0) > 1}
          onChange={e => decidir({ accion: 'formato', minPalabras: datos.preferencias.formato?.minPalabras || 0, minCapitulos: e.target.checked ? 2 : 0 })} />{t('discover.hide_oneshots')}</label>

        <select aria-label={t('discover.romance')} className={clase} value={datos.preferencias.formato?.romance || ''}
          onChange={e => decidir({ accion: 'formato', romance: e.target.value })}>
          <option value="">{t('discover.romance_show')}</option>
          <option value="hundir">{t('discover.romance_sink')}</option>
          <option value="ocultar">{t('discover.romance_hide')}</option>
        </select>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={datos.preferencias.aprender !== false}
        onChange={e => decidir({ accion: 'aprender', aprender: e.target.checked })} />{t('discover.learn')}</label>
      <div className="flex flex-wrap gap-2">
        {datos.preferencias.autores.map(a => <button key={a.clave} className={clase}
          onClick={() => decidir({ accion: 'desbloquearAutor', autor: a.clave })}>{t('discover.unblock')} · {a.nombre} ({a.fuente})</button>)}
        {datos.preferencias.fandoms.map(f => <button key={f} className={clase}
          onClick={() => decidir({ accion: 'mostrarFandom', fandom: f })}>{t('discover.show_again')} · {f}</button>)}
      </div>
    </fieldset>}
    {error && <p role="alert" className="text-amber-400 mt-2">{error}</p>}
    {aviso && <p role="status" className="text-gray-400 mt-2">{aviso}</p>}
  </details></>;
}
