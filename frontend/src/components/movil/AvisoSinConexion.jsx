import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../i18n/I18nContext';
import { Notice } from '../ui/Feedback';

export default function AvisoSinConexion() {
  const { t } = useI18n();
  const [sinConexion, setSinConexion] = useState(false);
  useEffect(() => {
    let espera;
    let cortado = false;
    const alCambiar = (e) => {
      if (e.detail) { cortado = false; clearTimeout(espera); setSinConexion(false); return; }
      if (cortado) return;
      cortado = true;

      espera = setTimeout(() => {
        setSinConexion(true);
        espera = setTimeout(() => setSinConexion(false), 6000);
      }, 3000);
    };
    window.addEventListener('mylaiberry-conexion', alCambiar);
    return () => { window.removeEventListener('mylaiberry-conexion', alCambiar); clearTimeout(espera); };
  }, []);

  return (
    <AnimatePresence>
      {sinConexion && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[400] rounded-lg bg-surface shadow-lg whitespace-nowrap"
        >
          <Notice tone="warning" compact>{t('mobile.offline')}</Notice>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
