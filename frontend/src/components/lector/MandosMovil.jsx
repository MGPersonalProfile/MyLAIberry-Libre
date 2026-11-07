import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronsDown, Languages, List, Loader2, MessageCircle, Pause, Play, Type
} from 'lucide-react';

import AjustesDelLector from './AjustesDelLector';
import BarraDeVoz from './BarraDeVoz';
import { useI18n } from '../../i18n/I18nContext';

const ENTRA = { type: 'spring', damping: 30, stiffness: 380 };

export default function MandosMovil(p) {
  const { visibles, ajustesAbiertos, alAlternarAjustes } = p;
  return (
    <>
      <AnimatePresence>
        {visibles && <BarraDeArriba key="arriba" {...p} />}
        {visibles && <BarraDeAbajo key="abajo" {...p} />}
      </AnimatePresence>
      <AnimatePresence>
        {ajustesAbiertos && <HojaDeAjustes ajustes={p.ajustes} alCerrar={alAlternarAjustes} />}
      </AnimatePresence>
    </>
  );
}

function Boton({ etiqueta, activo, children, ...resto }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={`w-11 h-11 shrink-0 grid place-items-center rounded-full transition active:scale-90 disabled:opacity-30 ${activo ? 'bg-white/20' : 'active:bg-white/10'}`}
      {...resto}
    >
      {children}
    </button>
  );
}

function BarraDeArriba({ titulo, tituloCapitulo, alCerrar, traducido, traduciendo, cargando, alAlternarTraduccion }) {
  const { t } = useI18n();
  return (
    <motion.header
      data-mandos
      initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={ENTRA}
      className="fixed top-0 inset-x-0 z-[205] font-sans bg-[#141414]/80 backdrop-blur-xl text-white border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-12 px-1 flex items-center gap-1">
        <Boton etiqueta={t('common.close')} onClick={alCerrar}><ArrowLeft className="w-6 h-6" /></Boton>
        <div className="flex-1 min-w-0 text-center leading-tight">
          <p className="text-[13px] font-semibold truncate">{titulo}</p>
          <p className="text-[11px] text-white/60 truncate">{tituloCapitulo}</p>
        </div>
        <Boton
          etiqueta={traducido ? t('reader.read_original') : t('reader.read_in')}
          onClick={alAlternarTraduccion}
          disabled={traduciendo || cargando}
          activo={traducido}
        >
          {traduciendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Languages className={`w-5 h-5 ${traducido ? 'text-red-400' : ''}`} />}
        </Boton>
      </div>
    </motion.header>
  );
}

function BarraDeAbajo(p) {
  const { t } = useI18n();
  const { capitulo, total, porcentaje, alIr } = p;
  return (
    <motion.footer
      data-mandos
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={ENTRA}
      className="fixed bottom-0 inset-x-0 z-[205] font-sans bg-[#141414]/80 backdrop-blur-xl text-white border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {p.barraDeVoz && <BarraDeVoz {...p.barraDeVoz} />}
      <div className="px-4 pt-3 flex items-center gap-3 text-[11px] text-white/60 tabular-nums">
        <span className="shrink-0">{t('reader.chapter_of', { n: capitulo + 1, total })}</span>
        <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-red-600 rounded-full" style={{ width: `${porcentaje}%` }} />
        </div>
        <span className="shrink-0 w-8 text-right">{Math.round(porcentaje)}%</span>
      </div>
      <div className="h-14 px-2 flex items-center justify-between">
        <Boton etiqueta={t('reader.prev')} onClick={() => alIr(capitulo - 1)} disabled={capitulo <= 0}><ChevronLeft className="w-7 h-7" /></Boton>
        <Boton etiqueta={t('reader.toc_title')} onClick={p.alAlternarIndice} activo={p.indiceAbierto}><List className="w-6 h-6" /></Boton>
        <Boton etiqueta={t('reader.reading_settings')} onClick={p.alAlternarAjustes} activo={p.ajustesAbiertos}><Type className="w-6 h-6" /></Boton>
        {!!window.api?.asistenteChat && (
          <Boton etiqueta={t('assistant.ask')} onClick={p.alAlternarAsistente} activo={p.asistenteAbierto}><MessageCircle className="w-6 h-6" /></Boton>
        )}
        {p.hayVoz && (
          <Boton etiqueta={p.vozActiva ? t('reader.voice_stop') : t('reader.voice_play')} onClick={p.alAlternarVoz} activo={p.vozActiva}>
            {p.vozActiva ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Boton>
        )}
        <Boton etiqueta={t('reader.auto_scroll')} onClick={p.alAlternarAuto} activo={p.autoActivo}>
          <ChevronsDown className="w-6 h-6" />
        </Boton>
        <Boton etiqueta={t('reader.next')} onClick={() => alIr(capitulo + 1)} disabled={capitulo >= total - 1}><ChevronRight className="w-7 h-7" /></Boton>
      </div>
    </motion.footer>
  );
}

function HojaDeAjustes({ ajustes, alCerrar }) {
  const { t } = useI18n();
  return (
    <>
      <motion.div
        data-mandos
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[206] bg-black/40"
        onClick={alCerrar}
      />
      <motion.div
        data-mandos
        role="dialog"
        aria-label={t('reader.reading_settings')}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={ENTRA}
        className="fixed bottom-0 inset-x-0 z-[207] font-sans rounded-t-2xl bg-[#1c1c1e] text-white px-5 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        <div className="mx-auto mb-4 w-10 h-1.5 rounded-full bg-white/25" aria-hidden />
        <AjustesDelLector {...ajustes} enHoja />
      </motion.div>
    </>
  );
}
