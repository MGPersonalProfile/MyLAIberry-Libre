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

  const [recuperables, setRecuperables] = useState(null);
  const [verObras, setVerObras] = useState(false);
  const [mensajeRecup, setMensajeRecup] = useState(null);

  useEffect(() => {
    let vivo = true;
    window.api.listarCopias?.()
      .then(r => { if (vivo) setCopias(r?.status === 'ok' ? r.copias : []); })
      .catch(() => { if (vivo) setCopias([]); });
    window.api.listarRecuperables?.()
      .then(r => { if (vivo && r?.status === 'ok') setRecuperables(r.recuperables); })
      .catch(() => {});
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

  const ejecutarRecuperarObra = async (id) => {
    setTrabajando(true);
    try {
      const r = await window.api.recuperarObra(id);
      if (r?.status !== 'ok') throw new Error(r?.message || '');
      setMensajeRecup('Obra recuperada correctamente');
      setVuelta(n => n + 1);
    } catch (e) {
      setError(`No se pudo recuperar la obra: ${e.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  const ejecutarRecuperarCambios = async (id) => {
    setTrabajando(true);
    try {
      const r = await window.api.recuperarCambiosObra(id);
      if (r?.status !== 'ok') throw new Error(r?.message || '');
      setMensajeRecup(r.conflictos?.length
        ? `Cambios recuperados, salvo ${r.conflictos.join(', ')}: se anotó algo después de restaurar y se ha respetado.`
        : 'Cambios de la obra recuperados correctamente');
      setVuelta(n => n + 1);
    } catch (e) {
      setError(`No se pudieron recuperar los cambios de la obra: ${e.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  const ejecutarRecuperarTrabajos = async (ids) => {
    setTrabajando(true);
    try {
      const r = await window.api.recuperarTrabajos(ids);
      if (r?.status !== 'ok') throw new Error(r?.message || '');
      setMensajeRecup('Trabajos recuperados correctamente');
      setVuelta(n => n + 1);
    } catch (e) {
      setError(`No se pudieron recuperar los trabajos: ${e.message}`);
    } finally {
      setTrabajando(false);
    }
  };

  if (!window.api.listarCopias) return null;

  const pendientesObras = (recuperables?.obras || []).filter(o => !o.recuperada);
  const pendientesTrabajos = (recuperables?.trabajos || []).filter(t => !t.recuperado);
  const pendientesCambios = (recuperables?.obrasModificadas || []).filter(o => !o.recuperada);
  const hayRecuperables = pendientesObras.length > 0 || pendientesTrabajos.length > 0 || pendientesCambios.length > 0;

  return (
    <div className="mt-5 pt-4" data-copias>
      <Divider className="mb-4" />
      <h4 className="text-callout font-semibold text-text-primary mb-1">{t('backups.title')}</h4>
      <p className="text-footnote text-text-secondary mb-3">{t('backups.desc')}</p>

      {recuperables?.incompleta && (
        <p className="mb-4 p-3 rounded bg-surface-raised border border-warning/40 text-footnote text-warning font-medium" data-restauracion-a-medias>
          Hay una restauración a medias (paso «{recuperables.estado}»): hasta que termine no se puede decir qué obras quedan por recuperar.
        </p>
      )}
      {recuperables?.interrumpida && (
        <p className="mb-4 text-footnote text-text-secondary" data-restauracion-interrumpida>
          {recuperables.interrumpida.accion === 'completada'
            ? 'Una restauración se cortó a medias y se ha terminado al arrancar.'
            : 'Una restauración se cortó antes de cambiar la base: no se aplicó y la biblioteca sigue como estaba.'}
        </p>
      )}

      {hayRecuperables && (
        <div className="mb-4 p-3 rounded bg-surface-raised border border-warning/40" data-recuperables>
          <p className="text-footnote text-warning font-medium mb-2">
            Esta restauración ha dejado fuera obras y descargas posteriores. Sus archivos se han conservado.
          </p>
          <div className="flex flex-wrap gap-2 text-footnote mb-2">
            {pendientesObras.length > 0 && (
              <button
                disabled={trabajando}
                onClick={() => setVerObras(v => !v)}
                className="text-accent hover:underline font-medium"
              >
                Ver obras recuperables
              </button>
            )}
            {pendientesTrabajos.length > 0 && (
              <button
                disabled={trabajando}
                onClick={() => ejecutarRecuperarTrabajos(pendientesTrabajos.map(t => t.id))}
                className="text-accent hover:underline font-medium"
              >
                Recuperar trabajos pendientes
              </button>
            )}
          </div>
          {pendientesCambios.length > 0 && (
            <ul className="space-y-1 mt-2 text-footnote pl-2 border-l border-border" data-cambios-posteriores>
              {pendientesCambios.map(o => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{o.title || o.id} <span className="text-text-tertiary">({(o.cambios || []).join(', ')})</span></span>
                  <button
                    disabled={trabajando}
                    onClick={() => ejecutarRecuperarCambios(o.id)}
                    className="text-accent hover:underline font-medium"
                  >
                    Recuperar cambios
                  </button>
                </li>
              ))}
            </ul>
          )}
          {verObras && pendientesObras.length > 0 && (
            <ul className="space-y-1 mt-2 text-footnote pl-2 border-l border-border">
              {pendientesObras.map(o => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{o.title || o.id}</span>
                  <button
                    disabled={trabajando}
                    onClick={() => ejecutarRecuperarObra(o.id)}
                    className="text-accent hover:underline font-medium"
                  >
                    Recuperar obra
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mensajeRecup && <p className="text-caption text-success mt-1">{mensajeRecup}</p>}
        </div>
      )}

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
