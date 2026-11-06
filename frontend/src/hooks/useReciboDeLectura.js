import { useEffect, useRef, useState } from 'react';
import useSesionDeLectura from './useSesionDeLectura.js';

const SELECTOR = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,pre,div';

export function contarParrafos(html) {
  if (!html) return 0;
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const raiz = doc.body;
  raiz.querySelectorAll('script,style,noscript,[hidden]').forEach(n => n.remove());
  const hojas = [...raiz.querySelectorAll(SELECTOR)].filter(n => !n.querySelector(SELECTOR));
  const textos = hojas.map(n => n.textContent.trim()).filter(Boolean);
  return textos.length || (raiz.textContent.trim() ? 1 : 0);
}

export default function useReciboDeLectura({ storyId, capitulo, avance }) {

  useSesionDeLectura({ storyId, capitulo, avance });

  const [conteo, setConteo] = useState({ capitulo: -1, n: 0 });
  const parrafos = conteo.capitulo === capitulo ? conteo.n : 0;

  const selladoRef = useRef({ capitulo: -1, parrafo: -1 });
  const ultimoEnvioRef = useRef(0);

  const vivoRef = useRef({ capitulo, parrafo: -1 });

  const disponible = !!window.api?.asistenteLeido;

  useEffect(() => {
    if (!disponible || !storyId || !window.api?.getChapterContent) return undefined;
    let vivo = true;

    window.api.getChapterContent(storyId, capitulo)
      .then(html => { if (vivo) setConteo({ capitulo, n: contarParrafos(html) }); })
      .catch(() => {  });

    return () => { vivo = false; };
  }, [disponible, storyId, capitulo]);

  useEffect(() => {
    if (!disponible || !parrafos || !storyId) return;

    const parrafo = Math.max(0, Math.min(parrafos - 1, Math.floor(avance * parrafos)));
    vivoRef.current = { capitulo, parrafo };

    const sellado = selladoRef.current;
    const yaEstaba = sellado.capitulo === capitulo && parrafo <= sellado.parrafo;
    if (yaEstaba) return;
    if (Date.now() - ultimoEnvioRef.current < 3000) return;

    selladoRef.current = { capitulo, parrafo };
    ultimoEnvioRef.current = Date.now();
    window.api.asistenteLeido({ workId: String(storyId), chapter: capitulo, paragraph: parrafo })
      .catch(() => {  });
  }, [disponible, storyId, capitulo, avance, parrafos]);

  useEffect(() => {
    if (!disponible || !storyId) return undefined;
    return () => {
      const { capitulo: cap, parrafo } = vivoRef.current;
      const sellado = selladoRef.current;
      if (parrafo < 0) return;
      if (sellado.capitulo === cap && parrafo <= sellado.parrafo) return;
      window.api.asistenteLeido({ workId: String(storyId), chapter: cap, paragraph: parrafo })
        .catch(() => {  });
    };
  }, [disponible, storyId, capitulo]);

  const parrafoActual = parrafos
    ? Math.max(0, Math.min(parrafos - 1, Math.floor(avance * parrafos)))
    : 0;

  return {
    punto: parrafos ? { workId: String(storyId), chapter: capitulo, paragraph: parrafoActual } : null,
    parrafos
  };
}
