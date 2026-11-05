import { useEffect, useState } from 'react';

import { Divider } from '../ui/List';
import { formatBytes } from './formato';
import { useI18n } from '../../i18n/I18nContext';

export default function CopiasDeSeguridad() {
  const { t } = useI18n();
  const [copias, setCopias] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    window.api.listarCopias?.()
      .then(r => { if (vivo) setCopias(r?.status === 'ok' ? r.copias : []); })
      .catch(() => { if (vivo) setCopias([]); });
    return () => { vivo = false; };
  }, [vuelta]);

  const restaurar = async (archivo) => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await window.api.restaurarCopia(archivo);
      if (r?.status !== 'ok') throw new Error(r?.message || '');
      window.location.reload();
    } catch (e) {
      setError(e.message);
      setTrabajando(false);
      setConfirmar(null);
      setVuelta(n => n + 1);
    }
  };

  if (!window.api.listarCopias) return null;
  return (
    <div className="mt-5 pt-4" data-copias>
      <Divider className="mb-4" />
      <h4 className="text-callout font-semibold text-text-primary mb-1">{t('backups.title')}</h4>
      <p className="text-footnote text-text-secondary mb-3">{t('backups.desc')}</p>
      {copias === null ? <p className="text-footnote text-text-tertiary">{t('settings.loading')}</p>
        : copias.length === 0 ? <p className="text-footnote text-text-secondary">{t('backups.none')}</p> : (
          <ul className="space-y-1.5">
            {copias.map(c => (
              <li key={c.archivo} className="flex items-center gap-3 text-footnote">
                <span className="text-text-primary tabular-nums font-medium">{c.fecha}</span>
                <span className="text-text-secondary flex-1 min-w-0 truncate">
                  {c.motivo === 'antes-de-restaurar' ? t('backups.before_restore') : t('backups.daily')}
                  {' · '}{c.obras === null ? t('backups.unreadable') : t('backups.works', { n: c.obras })}
                  {' · '}{formatBytes(c.bytes)}
                </span>
                {confirmar === c.archivo ? (
                  <>
                    <button disabled={trabajando} onClick={() => restaurar(c.archivo)}
                      className="text-warning font-medium py-1 disabled:opacity-50">{trabajando ? t('backups.restoring') : t('backups.confirm')}</button>
                    <button disabled={trabajando} onClick={() => setConfirmar(null)} className="text-text-secondary py-1">{t('common.cancel')}</button>
                  </>
                ) : (
                  <button disabled={trabajando || c.obras === null} onClick={() => setConfirmar(c.archivo)}
                    className="text-accent hover:underline py-1 disabled:opacity-40 font-medium">{t('backups.restore')}</button>
                )}
              </li>
            ))}
          </ul>
        )}
      {confirmar && <p className="text-footnote text-warning mt-2" role="alert">{t('backups.warning')}</p>}
      {error && <p className="text-footnote text-danger mt-2" role="alert">{t('backups.error')} {error}</p>}
    </div>
  );
}
