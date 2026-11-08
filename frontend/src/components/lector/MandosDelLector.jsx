import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, List, Loader2, Languages, Play, Pause, MessageCircle } from 'lucide-react';

import AjustesDelLector from './AjustesDelLector';
import { useI18n } from '../../i18n/I18nContext';
import { IconButton } from '../ui/Buttons';

const CLASE_MANDO = '!rounded-full hover:!bg-white/10 backdrop-blur-md !text-white';

export default function MandosDelLector({
  titulo, tituloCapitulo, alCerrar,
  traducido, traduciendo, progresoTrad, alAlternarTraduccion, cargando,
  vozActiva, hayVoz, alAlternarVoz,
  indiceAbierto, alAlternarIndice,
  asistenteAbierto, alAlternarAsistente,
  ajustesAbiertos, alAlternarAjustes, ajustes
}) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-8 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-[205]"
    >
      <IconButton
        icon={ArrowLeft}
        label={t('common.close')}
        onClick={alCerrar}
        className={CLASE_MANDO}
      />

      <div className="flex items-center gap-4 text-white backdrop-blur-md bg-black/30 px-4 py-2 rounded-full shadow-lg">
        <span className="font-bold text-sm tracking-widest uppercase opacity-90 truncate max-w-xs">{titulo}</span>
        <span className="opacity-50">|</span>
        <span className="text-sm opacity-80 truncate max-w-xs">{tituloCapitulo}</span>
      </div>

      <div className="flex gap-2 text-white relative items-center">

        <button
          onClick={alAlternarTraduccion}
          disabled={traduciendo || cargando}
          title={traducido ? t('reader.read_original') : t('reader.read_in')}
          className={`px-3 py-2 rounded-full transition-colors backdrop-blur-md flex items-center gap-2 text-sm ${
            traducido ? 'bg-red-600/90 hover:bg-red-600' : 'hover:bg-white/10'
          } ${traduciendo ? 'opacity-70 cursor-wait' : ''}`}
        >
          {traduciendo
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Languages className="w-4 h-4" />}
          <span className="hidden sm:inline">
            {traduciendo
              ? (progresoTrad > 0 ? t('reader.translating_pct', { pct: progresoTrad }) : t('reader.translating'))
              : (traducido ? t('reader.read_original') : t('reader.read_in'))}
          </span>
        </button>

        {hayVoz && (
          <IconButton
            icon={vozActiva ? Pause : Play}
            label={vozActiva ? t('reader.voice_stop') : t('reader.voice_play')}
            onClick={alAlternarVoz}
            className={`${CLASE_MANDO} ${vozActiva ? '!bg-white/20' : ''}`}
          />
        )}

        <IconButton
          icon={List}
          label={t('reader.toc_title')}
          onClick={alAlternarIndice}
          className={`${CLASE_MANDO} ${indiceAbierto ? '!bg-white/20' : ''}`}
        />

        {!!window.api?.asistenteChat && (
          <IconButton
            icon={MessageCircle}
            label={t('assistant.ask')}
            onClick={alAlternarAsistente}
            className={`${CLASE_MANDO} ${asistenteAbierto ? '!bg-white/20' : ''}`}
          />
        )}

        <div className="relative">
          <IconButton
            icon={Settings}
            label={t('reader.reading_settings')}
            onClick={alAlternarAjustes}
            className={`${CLASE_MANDO} ${ajustesAbiertos ? '!bg-white/20' : ''}`}
          />

          <AnimatePresence>
            {ajustesAbiertos && (
              <AjustesDelLector {...ajustes} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
