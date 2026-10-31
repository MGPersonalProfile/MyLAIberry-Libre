import { motion } from 'framer-motion';
import { Library, Info, Plus } from 'lucide-react';

import Carousel from '../Carousel';
import Baya from '../Baya';
import PortadaMovil from './PortadaMovil';
import useEsMovil from '../../hooks/useEsMovil';
import heroPorDefecto from '../../assets/hero.png';
import { useI18n } from '../../i18n/I18nContext';

export function InicioVacio({ alImportar }) {
  const { t } = useI18n();
  return (
    <main className="relative w-full h-[85vh] flex items-center justify-center px-12 mt-8">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/90 to-[#1a1a1a]"></div>
      </div>

      <div className="relative z-10 text-center max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <div className="w-24 h-24 mb-6 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20">
            <Baya className="w-14 h-14" />
          </div>
          <h2 className="text-4xl font-black mb-4 font-serif text-white">{t('empty.title')}</h2>
          <p className="text-lg text-gray-400 mb-8 font-medium">
            {t('empty.body')}
          </p>
          <button
            onClick={alImportar}
            className="bg-white text-black px-8 py-4 rounded font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors text-lg shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            <Plus className="w-5 h-5" /> {t('empty.cta')}
          </button>
        </motion.div>
      </div>
    </main>
  );
}

export default function Inicio({
  hero, fondoHero, sinopsisHero, filas, biblioteca, descubrimientos,
  acciones, alAbrirDescubrimiento, alVerFicha, alLeerHero, alAlternarMiLista
}) {
  const { t } = useI18n();
  const esMovil = useEsMovil();
  return (
    <>
      {esMovil ? (
        <PortadaMovil hero={hero} alLeer={alLeerHero} alVerFicha={alVerFicha} alAlternarMiLista={alAlternarMiLista} />
      ) : (
      <main className="relative w-full h-[85vh] flex items-end pb-32 px-12 mt-8">
        <div className="absolute inset-0 z-0">

          <img
            src={fondoHero || heroPorDefecto}
            alt={t('hero.alt')}
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent"></div>
          <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-red-600 font-black tracking-[0.2em] text-[11px] md:text-sm bg-black/50 px-2 py-1 rounded">{t('hero.badge')}</span>
            </div>
            <h2 className="text-4xl md:text-7xl font-black mb-3 md:mb-4 font-serif leading-[1.05] md:leading-tight text-white drop-shadow-2xl line-clamp-3 break-words">{hero.title}</h2>
            <p className="text-[15px] md:text-lg text-gray-200 mb-6 md:mb-8 line-clamp-2 md:line-clamp-3 drop-shadow-md text-shadow font-medium">
              {sinopsisHero.texto}
            </p>
            <div className="flex gap-3 md:gap-4">
              <button
                onClick={() => alLeerHero(hero)}
                className="flex-1 min-w-0 md:flex-none justify-center whitespace-nowrap bg-white text-black px-4 md:px-8 h-12 md:h-auto md:py-3 rounded-md font-bold flex items-center gap-2 hover:bg-gray-200 active:scale-[0.98] transition text-base md:text-xl"
              >
                <Library className="w-5 h-5 md:w-6 md:h-6 fill-black shrink-0" /> {t('detail.read_chapter', { n: (hero.currentChapter || 0) + 1 })}
              </button>
              <button
                onClick={() => alVerFicha(hero)}
                className="flex-1 min-w-0 md:flex-none justify-center whitespace-nowrap bg-gray-500/50 backdrop-blur-md text-white px-4 md:px-8 h-12 md:h-auto md:py-3 rounded-md font-bold flex items-center gap-2 hover:bg-gray-500/70 active:scale-[0.98] transition text-base md:text-xl border border-gray-400/30"
              >
                <Info className="w-5 h-5 md:w-6 md:h-6 shrink-0" /> <span className="truncate">{t('hero.more_info')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      </main>
      )}

      <div className="relative z-20 md:-mt-24 flex flex-col gap-6 md:gap-8">
        {filas.conNuevos.length > 0 && (
          <Carousel title={t('carousel.new_chapters')} items={filas.conNuevos} {...acciones} />
        )}

        {filas.enCurso.length > 0 && (
          <Carousel title={t('carousel.continue')} items={filas.enCurso} {...acciones} />
        )}

        {descubrimientos.length > 0 && (
          <Carousel
            title={t('carousel.discoveries')}
            items={descubrimientos}
            onSelect={alAbrirDescubrimiento}
            onDetail={alVerFicha}
            onDownload={alAbrirDescubrimiento}
          />
        )}

        {filas.recientes.length > 0 && (
          <Carousel title={t('carousel.recent')} items={filas.recientes} {...acciones} />
        )}

        {biblioteca.length > 0 && (
          <Carousel title={t('carousel.all')} items={biblioteca} {...acciones} onSelect={alVerFicha} />
        )}

        {filas.alDia.length > 0 && (
          <Carousel title={t('carousel.caught_up')} items={filas.alDia} {...acciones} />
        )}

        {filas.completadas.length > 0 && (
          <Carousel title={t('carousel.completed')} items={filas.completadas} {...acciones} />
        )}
      </div>
    </>
  );
}
