import { Library, Download } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

export default function AccionesPrincipales({ obra, descarga, movil, alLeer, alDescargar }) {
  const { t } = useI18n();
  const { hechos, total, pendiente, enCurso } = descarga;
  const ancho = movil ? 'w-full h-12' : 'flex-1 min-w-[14rem] py-3';
  return (
    <div className={movil ? 'space-y-2.5 mb-5' : 'flex flex-wrap gap-3'}>
      <button
        type="button"
        onClick={() => alLeer(obra)}
        disabled={obra.needsChapterSelection}
        className={`${ancho} bg-white text-black px-6 rounded-lg font-bold flex items-center justify-center gap-2 whitespace-nowrap hover:bg-gray-200 active:scale-[0.98] transition`}
      >
        <Library className="w-5 h-5 fill-black" /> {t('detail.read_chapter', { n: (obra.currentChapter || 0) + 1 })}
      </button>

      {pendiente && (
        <button
          type="button"
          onClick={() => alDescargar(obra)}
          disabled={enCurso || obra.needsChapterSelection}
          className={`${ancho} px-6 rounded-lg font-bold flex items-center justify-center gap-2 whitespace-nowrap transition bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed`}
        >
          <Download className={`w-5 h-5 shrink-0 ${enCurso ? 'animate-pulse' : ''}`} />
          {enCurso
            ? t('detail.downloading', { done: hechos, total: total })
            : hechos > 0
              ? t('detail.resume', { n: total - hechos })
              : t('detail.download_all', { n: total })}
        </button>
      )}
    </div>
  );
}
