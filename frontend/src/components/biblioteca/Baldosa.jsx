import Cover from '../Cover';
import { usaPortadaDelSitio } from '../../portada';
import { pulsable } from '../../pulsable';
import { Card } from '../ui/Layout';
import { ProgressIndicator } from '../ui/Feedback';

export default function Baldosa({ obra, alAbrir, children }) {
  const pct = obra.currentChapter > 0 && obra.totalChapters > 0
    ? ((obra.currentChapter + 1) / obra.totalChapters) * 100
    : 0;

  return (
    <div className="group relative">
      <Card
        padded={false}
        className="relative cursor-pointer overflow-hidden aspect-[2/3] transition-transform duration-normal active:scale-[0.97] md:group-hover:scale-[1.03] md:group-hover:z-10 md:group-hover:shadow-xl md:group-hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        {...pulsable(() => alAbrir(obra), obra.title)}
      >
        <Cover story={obra} className="w-full h-full" imgClassName="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {usaPortadaDelSitio(obra) && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5 md:p-3.5">
            <h4 className="font-semibold text-white text-caption md:text-footnote leading-tight line-clamp-2 drop-shadow-md">
              {obra.title}
            </h4>
            <p className="hidden md:block text-caption text-white/75 mt-1 line-clamp-1">{obra.author}</p>
          </div>
        )}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0">
            <ProgressIndicator value={pct} className="rounded-none h-1" />
          </div>
        )}
      </Card>
      {children}
    </div>
  );
}
