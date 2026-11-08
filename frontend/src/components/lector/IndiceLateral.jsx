import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, X, Check, Download } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import { IconButton } from '../ui/Buttons';
import { pulsable } from '../../pulsable';
import BuscarEnLaObra from './BuscarEnLaObra';

export default function IndiceLateral({
  capitulos, actual, descargados, tituloDe, alElegir, alCerrar, obraId, idioma
}) {
  const { t } = useI18n();

  const listaRef = useRef(null);
  const actualRef = useRef(null);
  useEffect(() => {
    const lista = listaRef.current, el = actualRef.current;
    if (lista && el) lista.scrollTop = el.offsetTop - lista.clientHeight / 2 + el.offsetHeight / 2;
  }, []);
  return (

    <motion.div className="fixed inset-0 z-[210]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="absolute inset-0 bg-black/50" {...pulsable(alCerrar, t('reader.close_toc'))} />
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="dark absolute top-0 right-0 w-96 max-w-[85vw] h-full bg-surface text-text-primary border-l border-border shadow-2xl flex flex-col"
    >
      <div className="flex items-center justify-between p-6 border-b border-separator">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-accent" />
          <h3 className="text-title-3 text-text-primary">{t('reader.chapters')}</h3>
        </div>
        <IconButton icon={X} onClick={alCerrar} label={t('reader.close_toc')} />
      </div>
      {obraId != null && <BuscarEnLaObra obraId={obraId} idioma={idioma} actual={actual} total={Math.max(capitulos.length, descargados || 0)} alElegir={alElegir} />}
      <div ref={listaRef} className="relative flex-1 overflow-y-auto py-2 scrollbar-hide">
        {capitulos.map((ch, idx) => (
          <button
            key={idx}
            ref={idx === actual ? actualRef : undefined}
            aria-current={idx === actual ? 'true' : undefined}
            onClick={() => alElegir(idx)}
            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
              idx === actual
                ? 'bg-red-500/10 text-red-400 border-r-2 border-red-500'
                : 'text-gray-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`text-xs font-mono w-8 shrink-0 ${
              idx === actual ? 'text-red-500' : 'text-gray-600'
            }`}>{idx + 1}</span>

            <span className="line-clamp-2 min-w-0 text-sm leading-snug flex-1">{tituloDe(idx)}</span>
            {idx < descargados ? (
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 opacity-50" />
            ) : (
              <Download className="w-3.5 h-3.5 text-gray-600 shrink-0 opacity-30" />
            )}
          </button>
        ))}
      </div>
      <div className="p-4 border-t border-white/10 text-center">
        <p className="text-xs text-gray-500 font-mono">{t('reader.toc_count', { i: actual + 1, n: capitulos.length })}</p>
        {descargados < capitulos.length && (
          <p className="text-xs text-gray-600 font-mono mt-1 flex items-center justify-center gap-1.5">
            <Download className="w-3 h-3" strokeWidth={1.5} />
            {t('reader.downloaded_count', { n: descargados })}
          </p>
        )}
      </div>
    </motion.div>
    </motion.div>
  );
}
