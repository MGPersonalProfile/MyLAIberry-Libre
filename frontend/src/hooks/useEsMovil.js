import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 767px)';

export default function useEsMovil() {
  const [esMovil, setEsMovil] = useState(() => window.matchMedia?.(CONSULTA).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(CONSULTA);
    if (!m) return undefined;
    const alCambiar = () => setEsMovil(m.matches);
    m.addEventListener('change', alCambiar);
    return () => m.removeEventListener('change', alCambiar);
  }, []);
  return esMovil;
}
