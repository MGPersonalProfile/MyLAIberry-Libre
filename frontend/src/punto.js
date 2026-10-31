export function clavePunto(punto) {
  if (!punto) return '';
  return `${punto.workId}:${punto.chapter}:${punto.paragraph}`;
}

export function puntoDeClave(clave) {
  if (!clave) return null;
  const [workId, chapter, paragraph] = String(clave).split(':');
  return { workId, chapter: Number(chapter), paragraph: Number(paragraph) };
}
