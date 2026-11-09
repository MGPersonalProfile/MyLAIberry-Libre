import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../i18n/I18nContext';
import { Notice } from '../ui/Feedback';
import { textoSinConexion } from '../../equipo';

export default function AvisoSinConexion() {
  const { lang } = useI18n();
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
          className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[400] w-[92vw] max-w-md rounded-lg bg-surface shadow-lg"
        >
          <Notice tone="warning" compact>{textoSinConexion({ lang, sufijo: 'offline.guardado' })}</Notice>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
