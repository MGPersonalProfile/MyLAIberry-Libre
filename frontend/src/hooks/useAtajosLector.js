import { useEffect } from 'react';

export default function useAtajosLector({
  capitulo, total, irA, ajustesAbiertos, indiceAbierto,
  alternarAjustes, alternarIndice, cerrarPaneles, alCerrarRef
}) {
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (ajustesAbiertos || indiceAbierto) {
        if (e.key === 'Escape') cerrarPaneles();
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (capitulo > 0) irA(prev => prev - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (capitulo < total - 1) irA(prev => prev + 1);
          break;
        case 'Escape':
          alCerrarRef.current();
          break;
        case 't': case 'T':
          alternarIndice();
          break;
        case 's': case 'S':
          alternarAjustes();
          break;
      }
    };

    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);

  }, [capitulo, total, ajustesAbiertos, indiceAbierto]);
}
