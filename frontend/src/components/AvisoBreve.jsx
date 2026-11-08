import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Notice } from './ui/Feedback';
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
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-8 z-[450] max-w-[92vw] rounded-lg bg-surface shadow-xl"
        >
          <Notice tone={aviso.tipo === 'error' ? 'warning' : 'success'} compact>{aviso.texto}</Notice>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
