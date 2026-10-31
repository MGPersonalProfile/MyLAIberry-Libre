import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';
import { LANGS } from '../i18n/dicts';
import { PESTANAS } from './pestanas';
import { pulsable } from '../pulsable';
import Baya from './Baya';

export default function BarraSuperior({
  vista, alIrA, scrolled, consulta, alBuscar,
  buscadorAbierto, alAlternarBuscador, alImportar, lang, alCambiarIdioma
}) {
  const { t } = useI18n();
  return (
    <nav className={`flex items-center justify-between gap-4 px-6 lg:px-12 pb-4 pt-11 fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-[#141414] border-b border-white/10 shadow-lg shadow-black/50'
        : 'bg-gradient-to-b from-black/90 to-transparent'
    }`}>

      <div className="flex items-center gap-4 lg:gap-8 min-w-0">
        <h1
          className="flex items-center gap-1.5 text-3xl font-bold text-red-600 tracking-tighter cursor-pointer shrink-0"
          {...pulsable(() => alIrA('inicio'), 'MyLAIberry — ir al inicio')}
        ><Baya className="w-7 h-7 -mt-1" />MyLAIberry</h1>

        <ul className="flex gap-6 text-sm font-medium text-gray-300 whitespace-nowrap min-w-0 overflow-x-auto scrollbar-hide">
          {PESTANAS.map(p => (
            <li
              key={p.id}
              {...pulsable(() => alIrA(p.id), t(p.clave))}
              aria-current={vista === p.id ? 'page' : undefined}
              className={`hover:text-white cursor-pointer transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${
                vista === p.id ? 'font-bold text-white' : ''
              }`}
            >
              {t(p.clave)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-4 shrink-0">

        <div className="relative flex items-center">
          <AnimatePresence>
            {buscadorAbierto && (
              <motion.input
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                type="text"
                placeholder={t('nav.search_placeholder')}
                value={consulta}
                onChange={e => alBuscar(e.target.value)}
                className="bg-black/70 border border-white/20 text-white placeholder-gray-500 px-4 py-1.5 rounded-md text-sm focus:outline-none focus:border-red-500 transition-colors mr-2"
                autoFocus
              />
            )}
          </AnimatePresence>

          <Search
            className={`w-5 h-5 cursor-pointer transition-colors ${buscadorAbierto ? 'text-red-500' : 'text-gray-300 hover:text-white'}`}
            onClick={alAlternarBuscador}
          />
        </div>
        <button
          onClick={alImportar}
          className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-md font-semibold hover:bg-gray-200 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('nav.import')}
        </button>
        <button
          onClick={() => alIrA('ajustes')}
          title={t('settings.nav')}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        <div className="flex items-center text-xs font-semibold" role="group" aria-label={t('nav.language')}>
          {LANGS.map(codigo => (
            <button
              key={codigo}
              onClick={() => alCambiarIdioma(codigo)}
              title={t('nav.language')}
              aria-pressed={lang === codigo}
              className={`px-1.5 py-1 rounded-md transition-colors ${
                lang === codigo
                  ? 'text-white bg-white/10'
                  : 'text-gray-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {codigo.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
