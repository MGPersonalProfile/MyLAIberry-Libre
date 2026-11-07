import { parsearImagenesComic } from './comic-parser.js';

export default function CapituloComic({
  content,
  esComic: esComicProp,
  cuerpo,
  lang,
  className = ''
}) {
  const parsed = parsearImagenesComic(content);
  const esComic = esComicProp || parsed.esComic;

  if (esComic) {
    const imagenes = parsed.imagenes;
    if (!imagenes.length) return null;

    return (
      <div className={`comic-reader flex flex-col items-center w-full select-none ${className}`}>
        {imagenes.map((img, i) => (
          <img
            key={img.indice ?? i}
            src={img.src}
            alt={img.alt || `Viñeta ${i + 1}`}
            width={img.ancho}
            height={img.alto}
            loading="lazy"
            className="w-full max-w-3xl block h-auto mx-auto my-0 p-0"
            style={{ aspectRatio: `${img.ancho} / ${img.alto}` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="prose prose-lg max-w-none reader-content"
      style={{ fontSize: `${cuerpo}px` }}
      lang={lang}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
