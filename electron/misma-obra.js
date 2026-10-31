function claveDeObra(url) {
  const u = String(url || '');
  const m = u.match(/archiveofourown\.org\/works\/(\d+)/) || u.match(/royalroad\.com\/fiction\/(\d+)/) ||
    u.match(/fanfiction\.net\/s\/(\d+)/) || u.match(/gutenberg\.org\/ebooks\/(\d+)/);
  return m ? m[0] : u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

const mismaObra = (a, b) => !!a && !!b && claveDeObra(a) === claveDeObra(b);

module.exports = { claveDeObra, mismaObra };
