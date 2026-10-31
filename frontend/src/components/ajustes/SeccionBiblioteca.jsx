import { Library, Download } from 'lucide-react';

import { Seccion, Dato } from './piezas';
import RehacerTraducciones from './RehacerTraducciones';
import CapitulosNuevosEnTodas from './CapitulosNuevosEnTodas';
import { formatBytes } from './formato';
import { useI18n } from '../../i18n/I18nContext';

export default function SeccionBiblioteca({ stats, pct, onCambio }) {
  const { t } = useI18n();
  return (
    <Seccion icono={Library} titulo={t('settings.library')} descripcion={t('settings.library_desc')}>
      {stats ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Dato valor={stats.fanfics} etiqueta={t('settings.stat_works')}
                  detalle={Object.entries(stats.porPlataforma).map(([k, v]) => `${v} ${k}`).join(' · ')} />
            <Dato valor={stats.capitulosEnDisco.toLocaleString()} etiqueta={t('settings.stat_chapters')}
                  detalle={t('settings.stat_of_total', { n: stats.capitulosListados.toLocaleString() })} />
            <Dato valor={stats.capitulosLeidos.toLocaleString()} etiqueta={t('settings.stat_read')}
                  detalle={t('settings.stat_in_progress', { n: stats.enCurso })} />
            <Dato valor={stats.traducidos.toLocaleString()} etiqueta={t('settings.stat_translated')}
                  detalle={formatBytes(stats.bytes)} />
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{t('settings.downloaded')}</span>
              <span className="tabular-nums">{pct} %</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 rounded-full transition-all duration-700"
                   style={{ width: `${pct}%` }} />
            </div>
            {stats.enCola > 0 && (
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <Download className="w-3 h-3" /> {t('settings.in_queue', { n: stats.enCola })}
              </p>
            )}
          </div>

          <CapitulosNuevosEnTodas onHecho={onCambio} />
          <RehacerTraducciones onHecho={onCambio} />
        </>
      ) : (
        <p className="text-sm text-gray-600">{t('settings.loading')}</p>
      )}
    </Seccion>

  );
}
