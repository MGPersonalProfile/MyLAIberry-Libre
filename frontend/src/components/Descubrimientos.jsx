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
import { PAGINA, REJILLA } from './pagina';
import { pulsable } from '../pulsable';
import { PageHeader } from './ui/Layout';
import { IconButton, SecondaryButton } from './ui/Buttons';
import { EmptyState } from './ui/Feedback';

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
        <PageHeader title={t('carousel.discoveries')} />
        <Preferencias alCambiar={alCambiar} />
        <EmptyState icon={Compass} title={t('discover.empty')} description={t('discover.empty_hint')} className="py-24" />
      </main>
    );
  }

  return (
    <main className={PAGINA}>
      <PageHeader title={t('carousel.discoveries')} subtitle={t('discover.subtitle')} />
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
        <EmptyState
          icon={Compass}
          title={t('discover.no_matches')}
          action={<SecondaryButton onClick={() => setFiltro({ ...FILTRO_VACIO })}>{t('discover.clear')}</SecondaryButton>}
        />
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
                  <IconButton
                    icon={Play}
                    title={sePuedeLeer(item) ? t('card.read') : t('discover.waiting')}
                    aria-label={t('card.read_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onAbrir && onAbrir(item); }}
                    className="!bg-white !text-black !rounded-full !p-3 [&_svg]:fill-black hover:!bg-gray-200 hover:scale-110"
                  />

                  <IconButton
                    icon={Plus}
                    title={t('discover.save')}
                    aria-label={t('discover.save_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onGuardar && onGuardar(item); }}
                    className="!text-white border-2 border-gray-400 !rounded-full hover:border-white hover:!bg-white/10"
                  />

                  <IconButton
                    icon={X}
                    title={t('detail.discard_title')}
                    aria-label={t('discover.discard_aria', { title: item.title })}
                    onClick={(e) => { e.stopPropagation(); onDescartar && onDescartar(item); }}
                    className="!text-white border-2 border-gray-400 !rounded-full hover:border-white hover:!bg-white/10"
                  />
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

              {item.explicacion?.advertencias?.length > 0 && (
                <p className="text-[11px] text-amber-500/80 mt-1 line-clamp-1 leading-snug">
                  {t('discover.unverified', { que: item.explicacion.advertencias.map(a => t('discover.field.' + a.campo)).join(', ') })}
                </p>
              )}
              {!item.explicacion?.advertencias?.length && item.explicacion?.desconocido?.length > 0 && (
                <p className="text-[11px] text-gray-600 mt-1 line-clamp-1 leading-snug">
                  {t('discover.not_published', { que: item.explicacion.desconocido.map(c => t('discover.field.' + c)).join(', ') })}
                </p>
              )}
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
