import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Compass, X, Play, Plus, Check, Clock } from 'lucide-react';

import Cover from './Cover';
import BarraDeFiltros from './descubrimientos/BarraDeFiltros';
import Preferencias from './descubrimientos/Preferencias';
import PorDecidir from './descubrimientos/PorDecidir';
import { porDecidir } from './descubrimientos/plazo';
import { aplicarFiltro, resumenDe, sePuedeLeer, FILTRO_VACIO } from './descubrimientos/filtros';
import { usaPortadaDelSitio } from '../portada';
import { useI18n } from '../i18n/I18nContext';
import { PAGINA, TITULO_PAGINA, SUBTITULO_PAGINA, REJILLA } from './pagina';
import { pulsable } from '../pulsable';

export default function Descubrimientos({ items = [], onAbrir, onDetalle, onDescartar, onGuardar, alCambiar }) {
  const { t } = useI18n();
  const [filtro, setFiltro] = useState(FILTRO_VACIO);

  const pendientes = useMemo(() => new Set(porDecidir(items).map(o => o.id)), [items]);
  const resto = useMemo(() => items.filter(o => !pendientes.has(o.id)), [items, pendientes]);
  const resumen = useMemo(() => resumenDe(resto), [resto]);
  const visibles = useMemo(() => aplicarFiltro(resto, filtro), [resto, filtro]);

  if (items.length === 0) {
    return (
      <main className={PAGINA}>
        <h2 className={TITULO_PAGINA}>{t('carousel.discoveries')}</h2>
        <Preferencias alCambiar={alCambiar} />
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <Compass className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-xl font-medium">{t('discover.empty')}</p>
          <p className="text-sm mt-2 max-w-md text-center">{t('discover.empty_hint')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={PAGINA}>
      <h2 className={TITULO_PAGINA}>{t('carousel.discoveries')}</h2>
      <p className={SUBTITULO_PAGINA}>{t('discover.subtitle')}</p>
      <Preferencias alCambiar={alCambiar} />
      <PorDecidir items={items} onDetalle={onDetalle} onGuardar={onGuardar} onDescartar={onDescartar} />

      <BarraDeFiltros
        filtro={filtro}
        alCambiar={setFiltro}
        resumen={resumen}
        total={resto.length}
        mostrados={visibles.length}
      />

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Compass className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t('discover.no_matches')}</p>
          <button
            onClick={() => setFiltro({ ...FILTRO_VACIO })}
            className="mt-4 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {t('discover.clear')}
          </button>
        </div>
      ) : (
        <div className={REJILLA}>
          {visibles.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group relative"
            >
              <div
                className="relative cursor-pointer rounded-md md:rounded-lg overflow-hidden aspect-[2/3] transition-transform duration-300 active:scale-[0.97] md:group-hover:scale-105 md:group-hover:z-10 md:group-hover:shadow-2xl md:group-hover:shadow-black/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                {...pulsable(() => onDetalle && onDetalle(item), item.title)}
              >
                <Cover story={item} className="w-full h-full" imgClassName="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                {usaPortadaDelSitio(item) && (
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h4 className="font-bold text-white text-sm leading-tight line-clamp-2 drop-shadow-md">{item.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.author}</p>
                  </div>
                )}

                {!sePuedeLeer(item) && (
                  <div
                    title={t('discover.waiting')}
                    className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-gray-300 backdrop-blur-sm"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-2 backdrop-blur-sm">
                  <button
                    title={sePuedeLeer(item) ? t('card.read') : t('discover.waiting')}
                    aria-label={t('card.read_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onAbrir && onAbrir(item); }}
                    className="bg-white text-black rounded-full p-3 hover:bg-gray-200 transition-colors hover:scale-110"
                  >
                    <Play className="w-5 h-5 fill-black" />
                  </button>

                  <button
                    title={t('discover.save')}
                    aria-label={t('discover.save_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onGuardar && onGuardar(item); }}
                    className="border-2 border-gray-400 text-gray-200 rounded-full p-2.5 hover:border-white hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <button
                    title={t('detail.discard_title')}
                    aria-label={t('discover.discard_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onDescartar && onDescartar(item); }}
                    className="border-2 border-gray-400 text-gray-300 rounded-full p-2.5 hover:border-white hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-600 mt-2 flex items-center gap-2 flex-wrap">
                <span>{t('discover.chapters_short', { n: item.totalChapters || 0 })}</span>
                {item.completa === true && (
                  <span className="text-green-500/70 flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> {t('discover.state_done')}
                  </span>
                )}
                {(item.kudos || 0) > 0 && <span>{t('discover.kudos_short', { n: item.kudos.toLocaleString() })}</span>}
              </p>

              {item.porque?.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-snug">
                  {t('suggest.because', { tags: item.porque.join(', ') })}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
