import { useEffect, useState } from 'react';
import { BookOpen, Clock, Hash, Images } from 'lucide-react';
import { ProgressIndicator, Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

function formatearTamano(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function useComicInfo(obra) {
  const [comicInfo, setComicInfo] = useState(null);
  useEffect(() => {
    let activo = true;
    const esComic = obra?.esComic || obra?.tipo === 'comic' || /webtoon/i.test(obra?.source || '');
    if (!esComic || !obra?.id || !window.api?.estadoComic) return undefined;
    window.api.estadoComic(obra.id).then(r => {
      if (activo && r?.status === 'success') setComicInfo(r.data);
    }).catch(() => {});
    return () => { activo = false; };
  }, [obra?.id, obra?.esComic, obra?.tipo, obra?.source]);
  return comicInfo;
}

export default function DatosDeLaObra({ obra, descarga, movil, sinBarras }) {
  const { t } = useI18n();
  const comicInfo = useComicInfo(obra);

  const datos = [
    { icono: Hash, texto: t('detail.chapters_count', { n: obra.totalChapters || 0 }) },
    { icono: BookOpen, texto: t('detail.current_chapter', { n: (obra.currentChapter || 0) + 1 }) },
    { icono: Clock, texto: obra.source },
    comicInfo?.bytesTotal > 0 && {
      icono: Images,
      texto: t('detail.comic_panels_size', { tamano: formatearTamano(comicInfo.bytesTotal) })
    }
  ].filter(Boolean).filter(d => d.texto);

  const incompletos = comicInfo?.capitulosIncompletos || [];

  return (
    <>
      {incompletos.length > 0 && (
        <Notice variant="warning" compact className="mb-4">
          {t('detail.comic_incomplete_episodes', {
            episodios: incompletos.map(c => c.episodio || (c.indice + 1)).join(', ')
          })}
        </Notice>
      )}
      {movil ? (
        <p className="text-center text-footnote text-text-secondary mb-4">
          {datos.map(d => d.texto).join(' · ')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-6 mb-5">
          {datos.map(({ icono: Icono, texto }) => (
            <div key={texto} className="flex items-center gap-2 text-text-secondary">
              <Icono className="w-4 h-4 shrink-0" />
              <span className="text-small">{texto}</span>
            </div>
          ))}
        </div>
      )}
      {!sinBarras && <Barras obra={obra} descarga={descarga} />}
    </>
  );
}

export function Barras({ obra, descarga }) {
  const { t } = useI18n();
  if (!(obra.totalChapters > 0)) return null;
  const { hechos, total, pendiente, enCurso, mensaje, error } = descarga;
  const leidoPct = Math.round(((obra.currentChapter || 0) / obra.totalChapters) * 100);
  const descargaPct = total ? Math.round((hechos / total) * 100) : 0;

  return (
    <div className="mb-6 space-y-3">
      <ProgressIndicator
        value={leidoPct}
        label={t('detail.progress')}
        rightLabel={`${leidoPct}%`}
      />
      {pendiente && (
        <div className="space-y-2">
          <ProgressIndicator
            value={descargaPct}
            label={
              <>
                {t('detail.downloaded')}
                {enCurso && mensaje && <span className="text-accent ml-2">{mensaje}</span>}
              </>
            }
            rightLabel={`${hechos} / ${total}`}
          />
          {error && <Notice variant="error" compact>{error}</Notice>}
        </div>
      )}
    </div>
  );
}
