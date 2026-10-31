import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';
import { avisar, motivo, esFalloDelPC } from '../avisos';
import { useI18n } from '../i18n/I18nContext';

export default function AvisoBreve() {
  const { t } = useI18n();
  const [aviso, setAviso] = useState(null);
  useEffect(() => {
    let quitar;
    const alAvisar = (e) => {
      clearTimeout(quitar);
      setAviso(e.detail);
      quitar = setTimeout(() => setAviso(null), e.detail.tipo === 'error' ? 6000 : 3500);
    };

    const alRechazar = (e) => {
      if (!esFalloDelPC(e.reason)) return;
      e.preventDefault();
      avisar(t('aviso.fallo', { motivo: motivo(e.reason) }), 'error');
    };
    window.addEventListener('mylaiberry-aviso', alAvisar);
    window.addEventListener('unhandledrejection', alRechazar);
    return () => {
      window.removeEventListener('mylaiberry-aviso', alAvisar);
      window.removeEventListener('unhandledrejection', alRechazar);
      clearTimeout(quitar);
    };
  }, [t]);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.id}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-8 z-[450] flex items-center gap-2 max-w-[92vw] px-4 py-2.5 rounded-2xl bg-zinc-800/95 backdrop-blur text-[13px] text-gray-100 shadow-xl ring-1 ring-white/10"
        >
          {aviso.tipo === 'error'
            ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            : <Check className="w-4 h-4 text-green-400 shrink-0" />}
          <span className="leading-snug">{aviso.texto}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
