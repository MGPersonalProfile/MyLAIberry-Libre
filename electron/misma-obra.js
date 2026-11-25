const { rutaDeMangaDex, urlDeManga } = require('./scrapers/mangadex-url.js');

function claveDeObra(url) {
  const manga = rutaDeMangaDex(url);
  if (manga?.tipo === 'title') return urlDeManga(manga.id, manga.idioma);
  const u = String(url || '');

  const asura = u.match(/^https?:\/\/(?:www\.)?asurascans\.com\/comics\/([a-z0-9][a-z0-9-]*?)(?:-(?=[0-9a-f]*\d)[0-9a-f]{8})?(?:[/?#]|$)/i);
  if (asura) return `asurascans.com/comics/${asura[1].toLowerCase()}`;
  const m = u.match(/archiveofourown\.org\/works\/(\d+)/) || u.match(/royalroad\.com\/fiction\/(\d+)/) ||
    u.match(/fanfiction\.net\/s\/(\d+)/) || u.match(/gutenberg\.org\/ebooks\/(\d+)/) ||
    u.match(/webnovel\.com\/book\/(\d+)/) || u.match(/wetriedtls\.com\/series\/([^/?#]+)/);
  return m ? m[0] : u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

const mismaObra = (a, b) => !!a && !!b && claveDeObra(a) === claveDeObra(b);

module.exports = { claveDeObra, mismaObra };
