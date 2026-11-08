import { Play, Plus, ChevronDown } from 'lucide-react';
import { IconButton } from './ui/Buttons';
import { ProgressIndicator } from './ui/Feedback';
import Cover from './Cover';
import { useI18n } from '../i18n/I18nContext';
import { usaPortadaDelSitio } from '../portada';
import { pulsable } from '../pulsable';
import useEsMovil from '../hooks/useEsMovil';

function pendientes(item) {
  const total = item.totalChapters || (item.chapterList ? item.chapterList.length : 0);
  return Math.max(0, total - (item.downloadedChapters || 0));
}

export default function Carousel({ title, items, onSelect, onDetail, onDownload }) {
  const { t } = useI18n();

  const esMovil = useEsMovil();
  const alTocar = (item) => (esMovil && onDetail ? onDetail(item) : onSelect && onSelect(item));

  if (!items || items.length === 0) return null;

  return (
    <div className="py-2 md:py-4 relative group">
      <h3 className="text-lg md:text-xl font-bold text-gray-200 mb-2 md:mb-4 px-4 md:px-12 transition-colors hover:text-white">
        {title}
      </h3>

      <div className="flex overflow-x-auto gap-2 md:gap-4 px-4 md:px-12 pb-4 md:pb-8 pt-1 md:pt-4 scrollbar-hide snap-x scroll-smooth scroll-px-4 md:scroll-px-12 overscroll-x-contain">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative flex-none w-[112px] h-[168px] md:w-[200px] md:h-[300px] rounded md:rounded-md overflow-hidden transition-all duration-300 ease-in-out origin-center cursor-pointer group/card snap-start active:scale-[0.97] md:hover:scale-105 hover:z-20 hover:shadow-2xl hover:shadow-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
            {...pulsable(() => alTocar(item), item.title)}
          >

            <Cover
              story={item}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover transition-transform duration-300"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 transition-opacity duration-300"></div>

            {usaPortadaDelSitio(item) && (
              <div className="absolute bottom-0 left-0 right-0 p-2 md:p-4 transform translate-y-0 transition-transform duration-300">
                <h4 className="font-bold text-white text-[13px] md:text-lg leading-tight line-clamp-2 drop-shadow-md">{item.title}</h4>
                <p className="hidden md:block text-sm text-gray-300 mt-1 drop-shadow-md">{item.author}</p>
              </div>
            )}

            <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex-col justify-center items-center gap-3 backdrop-blur-sm hidden md:flex`}>
              <IconButton
                icon={Play}
                title={t('card.read')}
                aria-label={t('card.read_aria', { title: item.title })}
                className="!bg-white !text-black !rounded-full !p-3 [&_svg]:fill-black hover:!bg-gray-200 transform hover:scale-110"
                onClick={(e) => { e.stopPropagation(); onSelect && onSelect(item); }}
              />
              <div className="flex gap-3">

                <IconButton
                  icon={Plus}
                  title={pendientes(item) > 0
                    ? t('card.download_pending', { n: pendientes(item) })
                    : t('card.download_done')}
                  aria-label={t('card.download_aria', { title: item.title })}
                  disabled={pendientes(item) === 0}
                  className="!text-gray-300 border-2 border-gray-400 !rounded-full hover:border-white hover:!text-white hover:!bg-white/10"
                  onClick={(e) => { e.stopPropagation(); onDownload && onDownload(item); }}
                />
                <IconButton
                  icon={ChevronDown}
                  title={t('card.details')}
                  aria-label={t('card.details_aria', { title: item.title })}
                  className="!text-gray-300 border-2 border-gray-400 !rounded-full hover:border-white hover:!text-white hover:!bg-white/10"
                  onClick={(e) => { e.stopPropagation(); onDetail && onDetail(item); }}
                />
              </div>
              {item.currentChapter > 0 && item.totalChapters > 0 && (
                <ProgressIndicator
                  thin
                  value={((item.currentChapter + 1) / item.totalChapters) * 100}
                  className="w-3/4 mt-4"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
