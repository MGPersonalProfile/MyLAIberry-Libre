import Cover from '../Cover';
import { usaPortadaDelSitio } from '../../portada';
import { pulsable } from '../../pulsable';

export default function Baldosa({ obra, alAbrir, children }) {
  return (
    <div className="group relative">
      <div
        className="relative cursor-pointer rounded-md md:rounded-lg overflow-hidden aspect-[2/3] transition-transform duration-300 active:scale-[0.97] md:group-hover:scale-105 md:group-hover:z-10 md:group-hover:shadow-2xl md:group-hover:shadow-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
        {...pulsable(() => alAbrir(obra), obra.title)}
      >
        <Cover story={obra} className="w-full h-full" imgClassName="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>

        {usaPortadaDelSitio(obra) && (
          <div className="absolute bottom-0 left-0 right-0 p-2 md:p-4">
            <h4 className="font-bold text-white text-[11px] md:text-sm leading-tight line-clamp-2 drop-shadow-md">{obra.title}</h4>
            <p className="hidden md:block text-xs text-gray-400 mt-1 line-clamp-1">{obra.author}</p>
          </div>
        )}
        {obra.currentChapter > 0 && obra.totalChapters > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
            <div className="h-full bg-red-600" style={{ width: `${((obra.currentChapter + 1) / obra.totalChapters) * 100}%` }}></div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
