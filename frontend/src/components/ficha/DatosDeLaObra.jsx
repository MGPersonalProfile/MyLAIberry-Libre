import { BookOpen, Clock, Hash } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function DatosDeLaObra({ obra, descarga, movil, sinBarras }) {
  const { t } = useI18n();
  const datos = [
    { icono: Hash, texto: t('detail.chapters_count', { n: obra.totalChapters || 0 }) },
    { icono: BookOpen, texto: t('detail.current_chapter', { n: (obra.currentChapter || 0) + 1 }) },
    { icono: Clock, texto: obra.source }
  ].filter(d => d.texto);

  return (
    <>
      {movil ? (
        <p className="text-center text-[13px] text-gray-400 mb-4">{datos.map(d => d.texto).join(' · ')}</p>
      ) : (
        <div className="flex gap-6 mb-6">
          {datos.map(({ icono: Icono, texto }) => (
            <div key={texto} className="flex items-center gap-2 text-gray-400">
              <Icono className="w-4 h-4" />
              <span className="text-sm">{texto}</span>
            </div>
          ))}
        </div>
      )}
      {!sinBarras && <Barras obra={obra} descarga={descarga} />}
    </>
  );
}

function Barra({ etiqueta, derecha, fraccion, color }) {
  return (
    <>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{etiqueta}</span>
        <span>{derecha}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${fraccion * 100}%` }} />
      </div>
    </>
  );
}

export function Barras({ obra, descarga }) {
  const { t } = useI18n();
  if (!(obra.totalChapters > 0)) return null;
  const { hechos, total, pendiente, enCurso, mensaje, error } = descarga;
  const leido = (obra.currentChapter || 0) / obra.totalChapters;
  return (
    <div className="mb-6">
      <Barra etiqueta={t('detail.progress')} derecha={`${Math.round(leido * 100)}%`} fraccion={leido} color="bg-red-600" />

      {pendiente && (
        <div className="mt-3">
          <Barra
            etiqueta={<>{t('detail.downloaded')}{enCurso && mensaje && <span className="text-blue-400 ml-2">{mensaje}</span>}</>}
            derecha={`${hechos} / ${total}`}
            fraccion={total ? hechos / total : 0}
            color="bg-blue-500"
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
