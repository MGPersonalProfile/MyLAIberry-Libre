import { motion } from 'framer-motion';
import { ProgressIndicator } from '../ui/Feedback';

export default function BarraDeProgreso({ porcentaje }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-0 left-0 right-0 z-[205]"
    >
      <ProgressIndicator thin value={porcentaje} className="[&>div]:rounded-none" />
    </motion.div>
  );
}
