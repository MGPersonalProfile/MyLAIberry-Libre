import { Smartphone } from 'lucide-react';

import { Seccion, Interruptor } from './piezas';
import { Divider } from '../ui/List';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function SeccionLan({ lan, cambiando, error, alAlternar, alCambiarCodigo, ajustes = {}, alGuardar = () => {}, movil = false }) {
  const { t } = useI18n();
  if (movil) {
    return (
      <Seccion icono={Smartphone} titulo={t('settings.lan')} descripcion={t('settings.lan_desc')}>
        <div className="max-w-2xl space-y-3">
          <p className="text-callout text-success font-medium">{t('settings.lan_mobile_on')}</p>
          {lan.urls?.length > 0 && (
            <ul className="space-y-1.5">
              {lan.urls.map(u => <li key={u} className="font-mono text-callout text-text-primary select-all break-all">{u}</li>)}
            </ul>
          )}
          <p className="text-footnote text-text-secondary">{t('settings.lan_code')}</p>
          <p className="text-footnote text-text-secondary">{t('settings.lan_mobile_note')}</p>
          <p className="text-footnote text-text-tertiary">{t('settings.lan_safety')}</p>
        </div>
      </Seccion>
    );
  }
  return (
    <Seccion icono={Smartphone} titulo={t('settings.lan')} descripcion={t('settings.lan_desc')}>
      <div className="max-w-2xl space-y-3">
        <Interruptor
          activo={lan.encendido}
          onChange={alAlternar}
          titulo={cambiando ? t('settings.lan_working') : t('settings.lan_switch')}
          descripcion={t('settings.lan_switch_desc')}
        />
        <Divider />
        <Interruptor
          activo={ajustes.movilSiempre === true}
          onChange={(v) => alGuardar({ movilSiempre: v })}
          titulo={t('settings.lan_always')}
          descripcion={t('settings.lan_always_desc')}
        />
        <Divider />
        <Interruptor
          activo={ajustes.abrirConWindows === true}
          onChange={(v) => alGuardar({ abrirConWindows: v })}
          titulo={t('settings.lan_login')}
          descripcion={t('settings.lan_login_desc')}
        />

        {lan.encendido && lan.urls?.length > 0 && (
          <div className="pt-2">
            <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">
              {t('settings.lan_open')}
            </p>
            <ul className="space-y-1.5">
              {lan.urls.map(u => (
                <li key={u} className="font-mono text-callout text-success select-all">{u}</li>
              ))}
            </ul>
            <p className="text-footnote text-text-secondary mt-3 max-w-xl">{t('settings.lan_code')}</p>
            <button
              type="button"
              onClick={alCambiarCodigo}
              disabled={cambiando}
              className="mt-2 text-footnote text-text-secondary underline decoration-dotted hover:text-text-primary disabled:opacity-50"
            >
              {t('settings.lan_new_code')}
            </button>
            <p className="text-footnote text-text-secondary mt-3 max-w-xl">{t('settings.lan_tailscale_on')}</p>
          </div>
        )}

        {lan.tailscale && !lan.tailscale.conectado && (
          <Notice tone="warning">{t('settings.lan_tailscale_off')}</Notice>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        <p className="text-footnote text-text-tertiary max-w-xl">{t('settings.lan_safety')}</p>
      </div>
    </Seccion>
  );
}
