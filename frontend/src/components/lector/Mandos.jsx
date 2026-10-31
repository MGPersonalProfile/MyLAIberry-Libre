import { AnimatePresence } from 'framer-motion';

import MandosDelLector from './MandosDelLector';
import MandosMovil from './MandosMovil';
import BarraDeProgreso from './BarraDeProgreso';

export default function Mandos({ esMovil, visibles, porcentaje, ...mandos }) {
  if (esMovil) return <MandosMovil visibles={visibles} porcentaje={porcentaje} {...mandos} />;
  return (
    <>
      <AnimatePresence>
        {visibles && <MandosDelLector {...mandos} />}
      </AnimatePresence>
      <AnimatePresence>
        {visibles && <BarraDeProgreso porcentaje={porcentaje} />}
      </AnimatePresence>
    </>
  );
}
