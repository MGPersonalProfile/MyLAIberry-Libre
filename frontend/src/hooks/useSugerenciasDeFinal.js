import { useState, useEffect } from 'react';

export default function useSugerenciasDeFinal({ storyId, enUltimoCapitulo }) {
  const [sugerencias, setSugerencias] = useState([]);

  useEffect(() => {
    if (!enUltimoCapitulo || !window.api?.getSuggestions) return undefined;
    let vivo = true;
    window.api.getSuggestions(storyId)
      .then(s => { if (vivo) setSugerencias(s || []); })
      .catch(() => {  });
    return () => { vivo = false; };
  }, [enUltimoCapitulo, storyId]);

  return sugerencias;
}
