import { Smartphone } from 'lucide-react';

import { Seccion, Interruptor } from './piezas';
import { useI18n } from '../../i18n/I18nContext';

export default function SeccionLan({ lan, cambiando, error, alAlternar, alCambiarCodigo, ajustes = {}, alGuardar = () => {}, movil = false }) {
  const { t } = useI18n();

  if (movil) {
    return (
      <Seccion icono={Smartphone} titulo={t('settings.lan')} descripcion={t('settings.lan_desc')}>
        <div className="max-w-2xl space-y-3">
          <p className="text-sm text-emerald-400">{t('settings.lan_mobile_on')}</p>
          {lan.urls?.length > 0 && (
            <ul className="space-y-1.5">
              {lan.urls.map(u => <li key={u} className="font-mono text-sm text-gray-300 select-all break-all">{u}</li>)}
            </ul>
          )}
          <p className="text-xs text-gray-500">{t('settings.lan_code')}</p>
          <p className="text-xs text-gray-400">{t('settings.lan_mobile_note')}</p>
          <p className="text-xs text-gray-500">{t('settings.lan_safety')}</p>
        </div>
      </Seccion>
    );
  }
  return (
    <Seccion icono={Smartphone} titulo={t('settings.lan')} descripcion={t('settings.lan_desc')}>
      <div className="max-w-2xl">
        <Interruptor
          activo={lan.encendido}
          onChange={alAlternar}
          titulo={cambiando ? t('settings.lan_working') : t('settings.lan_switch')}
          descripcion={t('settings.lan_switch_desc')}
        />
        <div className="mt-5 space-y-5">
          <Interruptor
            activo={ajustes.movilSiempre === true}
            onChange={(v) => alGuardar({ movilSiempre: v })}
            titulo={t('settings.lan_always')}
            descripcion={t('settings.lan_always_desc')}
          />
          <Interruptor
            activo={ajustes.abrirConWindows === true}
            onChange={(v) => alGuardar({ abrirConWindows: v })}
            titulo={t('settings.lan_login')}
            descripcion={t('settings.lan_login_desc')}
          />
        </div>

        {lan.encendido && lan.urls?.length > 0 && (
          <div className="mt-5 pl-[3.75rem]">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
              {t('settings.lan_open')}
            </p>
            <ul className="space-y-1.5">
              {lan.urls.map(u => (
                <li key={u} className="font-mono text-sm text-emerald-400 select-all">{u}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-3 max-w-xl">{t('settings.lan_code')}</p>
            <button
              type="button"
              onClick={alCambiarCodigo}
              disabled={cambiando}
              className="mt-2 text-xs text-gray-300 underline decoration-dotted hover:text-white disabled:opacity-50"
            >
              {t('settings.lan_new_code')}
            </button>
            <p className="text-xs text-gray-400 mt-3 max-w-xl">{t('settings.lan_tailscale_on')}</p>
          </div>
        )}

        {lan.tailscale && !lan.tailscale.conectado && (
          <p className="text-xs text-amber-400/80 mt-4 pl-[3.75rem] max-w-xl">{t('settings.lan_tailscale_off')}</p>
        )}

        {error && <p className="text-xs text-red-400 mt-4 pl-[3.75rem]">{error}</p>}

        <p className="text-xs text-gray-500 mt-4 pl-[3.75rem] max-w-xl">{t('settings.lan_safety')}</p>
      </div>
    </Seccion>
  );
}
