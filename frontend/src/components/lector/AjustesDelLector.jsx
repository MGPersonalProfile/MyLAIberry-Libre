import { motion } from 'framer-motion';
import { Moon, Sun, BookOpen, Type } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import AjustesDeVoz from '../AjustesDeVoz';
import BajarAudio from './BajarAudio';
import ObraEnteraEnMp3 from './ObraEnteraEnMp3';

export default function AjustesDelLector({
  tema, alCambiarTema,
  fuente, alCambiarFuente,
  cuerpo, alCambiarCuerpo,
  hayVoz, vocesDelIdioma, ajustesVoz, alCambiarVoz,
  autoVelocidad, alCambiarAutoVelocidad,

  audio,

  enHoja
}) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className={enHoja ? 'flex flex-col gap-6' : 'absolute right-0 top-12 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-6'}
    >

      <div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">{t('reader.theme')}</p>
        <div className="flex gap-2">
          <button onClick={() => alCambiarTema('dark')} className={`flex-1 py-2 max-md:min-h-11 rounded flex items-center justify-center gap-2 border ${tema === 'dark' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}><Moon className="w-4 h-4"/> {t('reader.theme_dark')}</button>
          <button onClick={() => alCambiarTema('sepia')} className={`flex-1 py-2 max-md:min-h-11 rounded flex items-center justify-center gap-2 border ${tema === 'sepia' ? 'border-orange-400 text-orange-400 bg-orange-400/10' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}><BookOpen className="w-4 h-4"/> {t('reader.theme_sepia')}</button>
          <button onClick={() => alCambiarTema('light')} className={`flex-1 py-2 max-md:min-h-11 rounded flex items-center justify-center gap-2 border ${tema === 'light' ? 'border-blue-400 text-blue-400 bg-blue-400/10' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}><Sun className="w-4 h-4"/> {t('reader.theme_light')}</button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">{t('reader.typography')}</p>
        <div className="flex gap-2">
          <button onClick={() => alCambiarFuente('serif')} className={`flex-1 py-2 max-md:min-h-11 rounded font-serif text-lg border ${fuente === 'serif' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}>{t('reader.font_serif')}</button>
          <button onClick={() => alCambiarFuente('sans')} className={`flex-1 py-2 max-md:min-h-11 rounded font-sans text-lg border ${fuente === 'sans' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}>{t('reader.font_sans')}</button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">{t('reader.size')}</p>
        <div className="flex items-center justify-between bg-black/30 rounded-lg p-1 border border-white/5">
          <button onClick={() => alCambiarCuerpo(-2)} className="p-2 max-md:w-11 max-md:h-11 max-md:grid max-md:place-items-center hover:text-red-500 transition-colors"><Type className="w-4 h-4" /></button>
          <span className="font-mono text-lg">{cuerpo}px</span>
          <button onClick={() => alCambiarCuerpo(2)} className="p-2 max-md:w-11 max-md:h-11 max-md:grid max-md:place-items-center hover:text-red-500 transition-colors"><Type className="w-6 h-6" /></button>
        </div>
      </div>

      {hayVoz && <AjustesDeVoz voces={vocesDelIdioma} ajustes={ajustesVoz} alCambiar={alCambiarVoz} />}
      {audio && (
        <div>
          <BajarAudio key={`${audio.obraId}:${audio.capitulo}:${audio.idioma || ''}`} {...audio} />
          <ObraEnteraEnMp3 key={`${audio.obraId}:${audio.idioma || ''}`} obraId={audio.obraId} idioma={audio.idioma} />
        </div>
      )}
      {enHoja && <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center justify-between gap-3">
        {t('reader.auto_speed')}
        <select value={autoVelocidad} onChange={e => alCambiarAutoVelocidad(Number(e.target.value))}
          className="min-h-11 rounded-lg bg-[#303034] text-white px-3 text-sm normal-case">
          <option value="20">{t('reader.auto_slow')}</option>
          <option value="30">{t('reader.auto_normal')}</option>
          <option value="45">{t('reader.auto_fast')}</option>
        </select>
      </label>}
    </motion.div>
  );
}
