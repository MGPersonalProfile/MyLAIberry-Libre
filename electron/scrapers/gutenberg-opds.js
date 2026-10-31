const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const texto = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#'
    ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1), e[1] === 'x' || e[1] === 'X' ? 16 : 10))
    : ENTIDADES[e.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();

function nombreLeible(nombre) {
  const [apellido, ...resto] = String(nombre || '').replace(/,\s*\d{3,4}\??-\d{0,4}\??$/, '').split(', ');
  return resto.length ? `${resto.join(' ')} ${apellido}`.trim() : apellido.trim();
}

const entradas = (xml) => String(xml || '').split('<entry>').slice(1).map(e => e.split('</entry>')[0]);
const primero = (e, re) => (e.match(re) || [])[1] || '';

function resultadosDeBusqueda(xml) {
  return entradas(xml).map(e => {
    const n = primero(e, /<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/);
    if (!n) return null;
    return {
      numero: n,
      titulo: texto(primero(e, /<title>([\s\S]*?)<\/title>/)),
      autor: texto(primero(e, /<content type="text">([\s\S]*?)<\/content>/))
    };
  }).filter(Boolean);
}

function campo(contenido, clave) {
  return texto(primero(contenido, new RegExp(`<p>\\s*${clave}:\\s*([\\s\\S]*?)</p>`)));
}

function fichaDeOpds(xml) {
  const e = entradas(xml)[0] || '';
  const contenido = primero(e, /<content type="xhtml">([\s\S]*?)<\/content>/);
  const materias = [...e.matchAll(/scheme="http:\/\/purl\.org\/dc\/terms\/LCSH" term="([^"]+)"/g)]
    .map(m => texto(m[1]).split(' -- ')[0].trim())
    .filter((s, i, todas) => s && s.length < 40 && todas.indexOf(s) === i);
  const enlace = (re) => primero(String(xml), re);
  return {
    titulo: texto(primero(e, /<title>([\s\S]*?)<\/title>/)),
    autores: [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map(m => nombreLeible(texto(m[1]))),
    idioma: texto(primero(e, /<dcterms:language>([\s\S]*?)<\/dcterms:language>/)),
    sinopsis: campo(contenido, 'Summary').replace(/\s*\(This is an automatically generated summary\.\)$/, ''),
    descargas: Number(campo(contenido, 'Downloads')) || 0,
    materias,
    portada: enlace(/href="(https:\/\/www\.gutenberg\.org\/cache\/epub\/\d+\/pg\d+\.cover\.medium\.jpg)"/),
    epub: enlace(/href="(https:\/\/www\.gutenberg\.org\/ebooks\/\d+\.epub3\.images)"/)
      || enlace(/href="(https:\/\/www\.gutenberg\.org\/ebooks\/\d+\.epub\.(?:no)?images)"/)
  };
}

module.exports = { resultadosDeBusqueda, fichaDeOpds, nombreLeible };
