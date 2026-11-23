const idiomas = Object.freeze(['es', 'es-la', 'en']);
const esIdiomaComic = idioma => idiomas.includes(idioma);
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const origen = 'https://mangadex.org';

function rutaDeMangaDex(entrada) {
  if (typeof entrada !== 'string') return null;
  try {
    const u = new URL(entrada.trim());
    if (!/^https?:$/.test(u.protocol) || !/^(?:www\.)?mangadex\.org$/.test(u.hostname) ||
        u.username || u.password || u.port) return null;
    const partes = u.pathname.replace(/\/$/, '').split('/');
    const [, tipo, id] = partes;

    const capitulo = tipo === 'chapter' && (partes.length === 3 || partes.length === 4 && /^\d+$/.test(partes[3]));
    if (!uuid.test(id || '') || !(tipo === 'title' && partes.length <= 4 || capitulo)) return null;
    const idioma = u.searchParams.get('lang');
    return { tipo, id: id.toLowerCase(), idioma: esIdiomaComic(idioma) ? idioma : undefined };
  } catch { return null; }
}

const urlDeManga = (id, idioma) => `${origen}/title/${id}${idioma ? `?lang=${idioma}` : ''}`;
module.exports = { origen, idiomas, esIdiomaComic, rutaDeMangaDex, urlDeManga, uuid };
