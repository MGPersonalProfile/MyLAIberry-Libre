import { useState } from 'react';
import { LogIn } from 'lucide-react';

import { Seccion } from './piezas';
import { useI18n } from '../../i18n/I18nContext';

function OtroSitio() {
  const { t } = useI18n();
  const [direccion, setDireccion] = useState('');
  const [estado, setEstado] = useState(null);
  const entrar = async () => {
    if (!direccion.trim()) return;
    setEstado({ esperando: true });
    try {
      const pc = window.mylaiberryPC?.entrarEnWeb && await window.mylaiberryPC.entrarEnWeb(direccion.trim());
      const r = pc ? (pc.status === 'ok' ? await window.api?.importarSesionWeb?.(pc.dominio, pc.cookies) : pc)
        : await window.api?.iniciarSesionWeb?.(direccion.trim());
      setEstado(r?.status === 'ok' ? { hecho: t('settings.sessions_other_done', { dominio: r.dominio }) } : { error: r?.message || '—' });
    } catch (e) { setEstado({ error: e.message }); }
  };
  return (
    <div className="mt-4 max-w-2xl bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
      <p className="text-sm text-white">{t('settings.sessions_other')}</p>
      <p className="text-xs text-gray-500 mt-0.5">{t('settings.sessions_other_desc')}</p>
      <div className="flex gap-2 mt-2">
        <input value={direccion} onChange={e => setDireccion(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()}
          placeholder={t('settings.sessions_other_placeholder')} aria-label={t('settings.sessions_other')}
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
        <button onClick={entrar} disabled={estado?.esperando || !direccion.trim()}
          className="px-3 py-1.5 rounded-lg text-xs bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-40 shrink-0">
          {estado?.esperando ? t('settings.sessions_waiting') : t('settings.sessions_in_action')}
        </button>
      </div>
      {estado?.hecho && <p className="text-xs text-emerald-400 mt-2">{estado.hecho}</p>}
      {estado?.error && <p className="text-xs text-red-400 mt-2">{estado.error}</p>}
    </div>
  );
}

export default function SeccionSesiones({ sitios, entrandoEn, alEntrar, alSalir, movil = false }) {
  const { t } = useI18n();
  return (
    <Seccion icono={LogIn} titulo={t('settings.sessions')} descripcion={t('settings.sessions_desc')}>
      <ul className="space-y-2 max-w-2xl">
        {sitios.map(s => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-white flex items-center gap-2">
                {s.nombre}
                {s.dentro === true && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-400/40 rounded px-1.5 py-0.5">
                    {s.usuario || t('settings.sessions_in')}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {s.dentro === true ? t('settings.sessions_benefit_on') : s.gana}
              </p>
            </div>

            {s.dentro === true ? (
              <button
                onClick={() => alSalir(s.id)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-gray-300 hover:border-red-500/60 hover:text-red-400 transition-colors shrink-0"
              >
                {t('settings.sessions_out')}
              </button>
            ) : movil ? (

              <span className="text-xs text-gray-500 shrink-0">{t('settings.sessions_mobile_out')}</span>
            ) : (
              <button
                onClick={() => alEntrar(s.id)}
                disabled={entrandoEn === s.id}
                className="px-3 py-1.5 rounded-lg text-xs bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-wait shrink-0"
              >
                {entrandoEn === s.id ? t('settings.sessions_waiting') : t('settings.sessions_in_action')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!movil && <OtroSitio />}
      {movil && <p className="text-xs text-gray-400 mt-3 max-w-xl">{t('settings.sessions_mobile')}</p>}
      <p className="text-xs text-gray-500 mt-3 max-w-xl">{t('settings.sessions_privacy')}</p>
    </Seccion>
  );
}
