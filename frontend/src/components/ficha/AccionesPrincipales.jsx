import { Library, Download } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { useI18n } from '../../i18n/I18nContext';

export default function AccionesPrincipales({ obra, descarga, movil, alLeer, alDescargar }) {
  const { t } = useI18n();
  const { hechos, total, pendiente, enCurso } = descarga;
  const ancho = movil ? 'w-full' : 'flex-1 min-w-[14rem]';

  return (
    <div className={movil ? 'space-y-2.5 mb-5' : 'flex flex-wrap gap-3'}>
      <PrimaryButton
        icon={Library}
        onClick={() => alLeer(obra)}
        disabled={obra.needsChapterSelection}
        className={ancho}
      >
        {t('detail.read_chapter', { n: (obra.currentChapter || 0) + 1 })}
      </PrimaryButton>

      {pendiente && (
        <SecondaryButton
          icon={Download}
          onClick={() => alDescargar(obra)}
          disabled={enCurso || obra.needsChapterSelection}
          className={ancho}
        >
          {enCurso
            ? t('detail.downloading', { done: hechos, total })
            : hechos > 0
              ? t('detail.resume', { n: total - hechos })
              : t('detail.download_all', { n: total })}
        </SecondaryButton>
      )}
    </div>
  );
}
