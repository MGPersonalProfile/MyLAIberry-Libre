import { motion } from 'framer-motion';
import { Play, Plus, Check } from 'lucide-react';

import Cover from '../Cover';
import { urlDePortada } from '../../portada';
import { useI18n } from '../../i18n/I18nContext';

export default function PortadaMovil({ hero, alLeer, alVerFicha, alAlternarMiLista }) {
  const { t } = useI18n();
  const fondo = urlDePortada(hero);
  const generos = (hero.tags || [])
    .filter(e => e.category === 'genre' && e.name)
    .slice(0, 3)
    .map(e => e.name);

  return (
    <main className="relative w-full pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-10 px-10 overflow-hidden">
      {fondo && (
        <img src={fondo} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#141414]/40 to-[#141414]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-[340px] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
      >
        <button type="button" onClick={() => alVerFicha(hero)} className="block w-full aspect-[2/3] active:opacity-90" aria-label={hero.title}>
          <Cover story={hero} className="w-full h-full" imgClassName="w-full h-full object-cover" />
        </button>
        <div className="absolute inset-x-0 bottom-0 pt-24 pb-4 px-4 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
          <h2 className="text-center font-serif font-black text-2xl leading-tight text-white line-clamp-2">{hero.title}</h2>
          {generos.length > 0 && (
            <p className="mt-1.5 text-center text-[13px] text-gray-300 truncate">{generos.join(' · ')}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => alLeer(hero)}
              className="h-11 rounded-md bg-white text-black font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition"
            >
              <Play className="w-5 h-5 fill-black" /> {t('mobile.read')}
            </button>
            <button
              type="button"
              onClick={() => alAlternarMiLista(hero)}
              className="h-11 rounded-md bg-white/20 backdrop-blur-md text-white font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition"
            >
              {hero.enMiLista ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />} {t('nav.mylist')}
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
