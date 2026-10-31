import { useState, useEffect, useCallback } from 'react';

export default function useTitulosDeCapitulo({ story, traducido }) {
  const [titulosTraducidos, setTitulosTraducidos] = useState(null);

  useEffect(() => {
    if (!traducido || !window.api?.getChapterTitles) return undefined;

    let vivo = true;
    window.api.getChapterTitles(story.id)
      .then(r => { if (vivo && r?.titulos?.length) setTitulosTraducidos(r.titulos); })
      .catch(() => {  });

    return () => { vivo = false; };
  }, [story.id, traducido]);

  return useCallback((indice) => {
    const original = story.chapterList?.[indice]?.title || '';
    if (!traducido) return original;
    return titulosTraducidos?.[indice] || original;
  }, [story.chapterList, traducido, titulosTraducidos]);
}
