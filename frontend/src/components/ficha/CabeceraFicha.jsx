import { X } from 'lucide-react';

import Cover from '../Cover';
import { urlDePortada } from '../../portada';
import { useI18n } from '../../i18n/I18nContext';

export default function CabeceraFicha({ obra, movil, alCerrar }) {
  if (movil) {
    const fondo = urlDePortada(obra);
    return (
      <div className="relative overflow-hidden pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 px-6 text-center">
        {fondo && <img src={fondo} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-[#181818]" />
        <div className="relative">
          <div className="mx-auto mb-4 w-10 h-1.5 rounded-full bg-white/30" aria-hidden />
          <div className="mx-auto w-40 aspect-[2/3] rounded-xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
            <Cover story={obra} className="w-full h-full" imgClassName="w-full h-full object-cover" />
          </div>
          <h2 className="mt-5 text-[26px] leading-tight font-black font-serif text-white">{obra.title}</h2>
          {obra.author && <p className="mt-1 text-[15px] text-gray-300">{obra.author}</p>}
          <LineaDeSerie obra={obra} className="mt-1 text-[13px] text-gray-400" />
        </div>
        <BotonCerrar alCerrar={alCerrar} className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4" />
      </div>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-t-2xl">
      <Cover story={obra} className="w-full h-full opacity-50" imgClassName="w-full h-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] to-transparent"></div>
      <BotonCerrar alCerrar={alCerrar} className="absolute top-4 right-4" />
      <div className="absolute bottom-6 left-8 right-8">
        <h2 className="text-4xl font-black font-serif text-white drop-shadow-2xl">{obra.title}</h2>
        <p className="text-gray-300 mt-2 font-medium">{obra.author}</p>
        <LineaDeSerie obra={obra} className="text-gray-400 mt-1 text-sm" />
      </div>
    </div>
  );
}

function LineaDeSerie({ obra, className }) {
  const { t } = useI18n();
  const series = Array.isArray(obra.series) ? obra.series.filter(s => s && s.nombre) : [];
  if (!series.length) return null;
  return (
    <p className={className}>
      {series.map(s => s.parte ? t('detail.series_part', { n: s.parte, nombre: s.nombre }) : t('detail.series_only', { nombre: s.nombre })).join(' · ')}
    </p>
  );
}

function BotonCerrar({ alCerrar, className }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={alCerrar}
      aria-label={t('common.close')}
      className={`${className} w-11 h-11 grid place-items-center rounded-full bg-black/50 hover:bg-black/70 active:bg-black/70 text-white transition-colors`}
    >
      <X className="w-5 h-5" />
    </button>
  );
}
