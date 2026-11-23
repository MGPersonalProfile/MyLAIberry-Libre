const { pedirComic } = require('./comic-red.js');
const { datosComic, tituloCapitulo, descargadorComic } = require('./comic.js');
const { origen, idiomas, esIdiomaComic, rutaDeMangaDex, urlDeManga, uuid } = require('./mangadex-url.js');
const { cabeceras } = require('../user-agent.js');

const API = 'https://api.mangadex.org';
const nombre = 'MangaDex';
const esUrlDeMangaDex = url => !!rutaDeMangaDex(url);
const consultar = (ruta, minimo = 250) => pedirComic(API + ruta, r => r.json(), {
  minimo, esperaDatos: true, headers: cabeceras({ Accept: 'application/json' }, { clienteApi: true })
});

function episodioDe(entrada, idioma) {
  const { id, attributes: a } = entrada;
  if (!uuid.test(id) || !(a?.pages > 0) || a.externalUrl || a.translatedLanguage !== idioma) return null;
  return {
    episodeNo: id, numero: a.chapter, idioma,
    title: a.title?.trim() || tituloCapitulo(a.chapter, idioma),
    url: `${origen}/chapter/${id}`
  };
}

async function leerFeed(id, idioma) {
  const query = new URLSearchParams({ 'translatedLanguage[]': idioma, 'order[chapter]': 'asc', limit: 500 });
  const vistos = new Map();
  let offset = 0;
  do {
    query.set('offset', offset);
    const pagina = await consultar(`/manga/${id}/feed?${query}`);
    for (const entrada of pagina.data) {
      const episodio = episodioDe(entrada, idioma);
      if (episodio) vistos.set(episodio.episodeNo, episodio);
    }
    offset += pagina.data.length;
    if (!pagina.data.length || offset >= pagina.total) break;
  } while (true);
  return [...vistos.values()];
}

async function leerIdioma(id, opciones, idiomaUrl) {
  const explicito = esIdiomaComic(opciones.idiomaComic) ? opciones.idiomaComic : idiomaUrl;
  const preferidos = explicito ? [explicito] : opciones.idiomaInterfaz === 'en' ? ['en'] : idiomas;
  for (const idioma of preferidos) {
    const capitulos = await leerFeed(id, idioma);
    if (capitulos.length || idioma === preferidos.at(-1)) return { idioma, capitulos };
  }
}

async function idDeManga(ruta) {
  if (ruta.tipo === 'title') return ruta.id;
  const { data } = await consultar(`/chapter/${ruta.id}`);
  const id = data.relationships.find(r => r.type === 'manga')?.id;
  if (!uuid.test(id)) throw new Error(nombre);
  return id;
}

function metadatos(id, manga, idioma) {
  const { attributes: a, relationships } = manga;
  const texto = valores => valores?.[idioma] || valores?.en || Object.values(valores || {})[0] || '';
  const portada = relationships.find(rel => rel.type === 'cover_art')?.attributes?.fileName;
  return {
    source: nombre, url: urlDeManga(id, idioma),
    title: texto(a.title) || nombre, synopsis: texto(a.description),
    author: relationships.filter(r => r.type === 'author').map(r => r.attributes?.name).filter(Boolean).join(', '),
    coverUrl: portada ? `https://uploads.mangadex.org/covers/${id}/${encodeURIComponent(portada)}.512.jpg` : '',
    language: idioma, idiomaComic: idioma, idiomasComic: idiomas
  };
}

async function obtenerEpisodios(url, _onProgress, opciones = {}) {
  const ruta = rutaDeMangaDex(url);
  if (!ruta) throw new Error(nombre);
  const id = await idDeManga(ruta);
  const { data } = await consultar(`/manga/${id}?includes%5B%5D=author&includes%5B%5D=cover_art`);
  const { idioma, capitulos } = await leerIdioma(id, opciones, ruta.idioma);
  return datosComic(metadatos(id, data, idioma), capitulos, opciones);
}

async function obtenerVinhetas(ch) {
  const ruta = rutaDeMangaDex(ch.url);
  if (ruta?.tipo !== 'chapter') throw new Error(nombre);

  const { baseUrl, chapter } = await consultar(`/at-home/server/${ruta.id}`, 1500);
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.port || base.username || base.password || base.search || base.hash ||
      !/^(?:[\w-]+\.mangadex\.network|uploads\.mangadex\.org)$/.test(base.hostname) ||
      !/^[\da-f]+$/i.test(chapter?.hash)) throw new Error(`${nombre} · At Home`);
  const directorio = `${base.href.replace(/\/$/, '')}/data/${chapter.hash}`;
  return chapter.data.map(n => {
    if (typeof n !== 'string' || !n || n === '.' || n === '..') throw new Error(`${nombre} · At Home`);
    return { url: `${directorio}/${encodeURIComponent(n)}` };
  });
}

const downloadChapters = descargadorComic({ fuente: 'mangadex', obtenerVinhetas });
module.exports = { esUrlDeMangaDex, obtenerEpisodios, scrape: obtenerEpisodios, obtenerVinhetas, downloadChapters };
