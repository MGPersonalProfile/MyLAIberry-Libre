import { Search, X, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { esViva } from '../../ejecuciones';

export default function EjecucionInvestigacion({ job, ejecucion, desactualizado, iniciar, cancelar, reintentar }) {
  const { t } = useI18n();
  const viva = esViva(ejecucion);
  const p = ejecucion?.progreso;
  const r = ejecucion?.resultado;
  const parada = ejecucion?.estado === 'cancelando';
  const puedeReintentar = ['fallida', 'interrumpida', 'cancelada'].includes(ejecucion?.estado);
  const errores = [...(ejecucion?.error ? [ejecucion.error.mensaje] : []), ...(r?.errores || [])];

  return (
    <div className="mt-2 border-t border-separator pt-2 space-y-1.5" data-ejecucion={ejecucion?.estado || 'ninguna'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <SecondaryButton size="sm" icon={Search} disabled={viva || job.status === 'closed'} onClick={() => iniciar(job.id)} className="whitespace-nowrap">
          {t('run.start')}
        </SecondaryButton>
        {viva && (
          <SecondaryButton size="sm" icon={X} disabled={parada} onClick={() => cancelar(ejecucion.executionId)} className="whitespace-nowrap">
            {parada ? t('run.cancelling') : t('run.cancel')}
          </SecondaryButton>
        )}
        {puedeReintentar && (
          <SecondaryButton size="sm" icon={RotateCcw} onClick={() => reintentar(ejecucion.executionId)} className="whitespace-nowrap">
            {t('run.retry')}
          </SecondaryButton>
        )}
      </div>

      {ejecucion && (
        <p className="text-caption text-text-secondary" role="status">
          {t(`run.state.${ejecucion.estado}`)}
          {viva && ejecucion.fase && ` · ${t(`run.phase.${ejecucion.fase}`)}`}
          {viva && p && ` (${p.hecho}/${p.total})`}
          {!viva && r && ` · ${t('run.found', { n: r.nuevas })}`}
          {r?.parcial && ` · ${t('run.partial')}`}
        </p>
      )}
      {viva && p && <progress className="w-full h-1" max={p.total} value={p.hecho} aria-label={t('run.progress')} />}
      {desactualizado && <Notice tone="warning" compact role="status">{t('run.stale')}</Notice>}
      {!!errores.length && <p className="text-caption text-warning">{errores.join(' · ')}</p>}
      {!!r?.sinConsultar?.length && <p className="text-caption text-text-secondary">{t('run.skipped', { fuentes: r.sinConsultar.join(', ') })}</p>}
    </div>
  );
}
