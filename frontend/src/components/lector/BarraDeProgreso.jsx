import { motion } from 'framer-motion';

export default function BarraDeProgreso({ porcentaje }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-0 left-0 right-0 h-1.5 bg-black/20 z-[205]"
    >
      <div className="h-full bg-red-600/80" style={{ width: `${porcentaje}%` }} />
    </motion.div>
  );
}
