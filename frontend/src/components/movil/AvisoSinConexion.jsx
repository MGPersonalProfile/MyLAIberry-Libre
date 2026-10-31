import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

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
          className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[400] flex items-center gap-2 px-3.5 h-8 rounded-full bg-zinc-800/95 backdrop-blur text-[13px] text-gray-200 shadow-lg ring-1 ring-white/10 whitespace-nowrap"
        >
          <CloudOff className="w-4 h-4 text-amber-400" /> {t('mobile.offline')}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
