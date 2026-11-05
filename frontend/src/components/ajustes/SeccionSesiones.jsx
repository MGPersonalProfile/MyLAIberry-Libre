import { useState } from 'react';
import { LogIn } from 'lucide-react';

import { Seccion } from './piezas';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Tag, Notice } from '../ui/Feedback';
import { Card } from '../ui/Layout';
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
    <Card className="mt-4 max-w-2xl bg-surface-secondary">
      <p className="text-callout font-medium text-text-primary">{t('settings.sessions_other')}</p>
      <p className="text-footnote text-text-secondary mt-0.5">{t('settings.sessions_other_desc')}</p>
      <div className="flex gap-2 mt-2.5">
        <input value={direccion} onChange={e => setDireccion(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()}
          placeholder={t('settings.sessions_other_placeholder')} aria-label={t('settings.sessions_other')}
          className="flex-1 min-w-0 bg-surface border border-border rounded-md px-3 py-1.5 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent" />
        <PrimaryButton size="sm" onClick={entrar} disabled={estado?.esperando || !direccion.trim()}>
          {estado?.esperando ? t('settings.sessions_waiting') : t('settings.sessions_in_action')}
        </PrimaryButton>
      </div>
      {estado?.hecho && <Notice tone="success" className="mt-2">{estado.hecho}</Notice>}
      {estado?.error && <Notice tone="danger" className="mt-2">{estado.error}</Notice>}
    </Card>
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
            className="flex items-center justify-between gap-4 bg-surface-secondary border border-border rounded-md px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-callout font-medium text-text-primary flex items-center gap-2">
                {s.nombre}
                {s.dentro === true && (
                  <Tag tone="success">
                    {s.usuario || t('settings.sessions_in')}
                  </Tag>
                )}
              </p>
              <p className="text-footnote text-text-secondary mt-0.5">
                {s.dentro === true ? t('settings.sessions_benefit_on') : s.gana}
              </p>
            </div>

            {s.dentro === true ? (
              <SecondaryButton size="sm" onClick={() => alSalir(s.id)}>
                {t('settings.sessions_out')}
              </SecondaryButton>
            ) : movil ? (
              <span className="text-footnote text-text-secondary shrink-0">{t('settings.sessions_mobile_out')}</span>
            ) : (
              <PrimaryButton
                size="sm"
                onClick={() => alEntrar(s.id)}
                disabled={entrandoEn === s.id}
              >
                {entrandoEn === s.id ? t('settings.sessions_waiting') : t('settings.sessions_in_action')}
              </PrimaryButton>
            )}
          </li>
        ))}
      </ul>
      {!movil && <OtroSitio />}
      {movil && <p className="text-footnote text-text-secondary mt-3 max-w-xl">{t('settings.sessions_mobile')}</p>}
      <p className="text-footnote text-text-tertiary mt-3 max-w-xl">{t('settings.sessions_privacy')}</p>
    </Seccion>
  );
}
