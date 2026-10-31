import { useState, useEffect } from 'react';

export default function useFondoHero(heroId) {
  const [fondo, setFondo] = useState(null);

  useEffect(() => {
    let vivo = true;

    const pedir = heroId && window.api?.getBackdrop
      ? window.api.getBackdrop(heroId).catch(() => null)
      : Promise.resolve(null);

    pedir.then(r => { if (vivo) setFondo(r?.ruta || null); });

    return () => { vivo = false; };
  }, [heroId]);

  return fondo;
}
