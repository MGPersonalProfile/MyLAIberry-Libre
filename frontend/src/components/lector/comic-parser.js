export function parsearImagenesComic(html) {
  if (!html || typeof html !== 'string') {
    return { esComic: false, imagenes: [] };
  }

  const esComicMarcado = /class=["'][^"']*comic-chapter[^"']*["']|data-tipo=["']comic["']/i.test(html);

  if (!esComicMarcado && !html.includes('comic-panel')) {
    return { esComic: false, imagenes: [] };
  }

  const imagenes = [];
  const reImg = /<img\b([^>]*?)>/gi;
  let match;
  let idx = 0;

  while ((match = reImg.exec(html)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;

    const src = srcMatch[1];
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const widthMatch = attrs.match(/\bwidth=["']?(\d+)["']?/i);
    const heightMatch = attrs.match(/\bheight=["']?(\d+)["']?/i);
    const indiceMatch = attrs.match(/\bdata-indice=["']?(\d+)["']?/i);

    imagenes.push({
      src,
      alt: altMatch ? altMatch[1] : `Viñeta ${idx + 1}`,
      ancho: widthMatch ? Number(widthMatch[1]) : 800,
      alto: heightMatch ? Number(heightMatch[1]) : 1280,
      indice: indiceMatch ? Number(indiceMatch[1]) : idx
    });
    idx++;
  }

  return {
    esComic: imagenes.length > 0,
    imagenes
  };
}
