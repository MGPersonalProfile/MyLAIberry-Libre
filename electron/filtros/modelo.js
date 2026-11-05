const CAMPOS = ['consulta', 'fandom', 'orden', 'minPalabras', 'maxPalabras', 'minCapitulos', 'generos', 'sinGeneros',
  'rating', 'idioma', 'estado', 'pareja', 'personajes', 'sinCrossovers'];

const ORDENES = ['popularidad', 'recientes', 'publicadas', 'palabras', 'relevancia'];
const RATINGS = ['general', 'adolescente', 'maduro', 'explicito'];
const ESTADOS = ['completa', 'en_curso'];

const GENEROS = {
  general: { ffn: 1, alias: ['general'] },
  romance: { ffn: 2, ao3: 'Romance', rr: 'romance_main', alias: ['romance', 'romantico', 'romántico'] },
  humor: { ffn: 3, ao3: 'Humor', rr: 'comedy', alias: ['humor', 'comedia', 'comedy', 'humour'] },
  drama: { ffn: 4, ao3: 'Drama', rr: 'drama', alias: ['drama'] },
  poesia: { ffn: 5, ao3: 'Poetry', alias: ['poesia', 'poesía', 'poetry'] },
  aventura: { ffn: 6, ao3: 'Adventure', rr: 'adventure', alias: ['aventura', 'aventuras', 'adventure'] },
  misterio: { ffn: 7, ao3: 'Mystery', rr: 'mystery', alias: ['misterio', 'mystery'] },
  terror: { ffn: 8, ao3: 'Horror', rr: 'horror', alias: ['terror', 'horror'] },
  parodia: { ffn: 9, ao3: 'Parody', rr: 'satire', alias: ['parodia', 'parody', 'satira', 'sátira', 'satire'] },
  angustia: { ffn: 10, ao3: 'Angst', alias: ['angustia', 'angst'] },
  sobrenatural: { ffn: 11, ao3: 'Supernatural', rr: 'supernatural', alias: ['sobrenatural', 'supernatural'] },
  suspense: { ffn: 12, ao3: 'Suspense', rr: 'thriller', alias: ['suspense', 'thriller', 'suspenso'] },
  ciencia_ficcion: { ffn: 13, ao3: 'Science Fiction', rr: 'sci_fi', alias: ['ciencia ficcion', 'ciencia ficción', 'sci-fi', 'science fiction', 'scifi'] },
  fantasia: { ffn: 14, ao3: 'Fantasy', rr: 'fantasy', alias: ['fantasia', 'fantasía', 'fantasy'] },
  espiritual: { ffn: 15, alias: ['espiritual', 'spiritual'] },
  tragedia: { ffn: 16, ao3: 'Tragedy', rr: 'tragedy', alias: ['tragedia', 'tragedy'] },
  western: { ffn: 17, ao3: 'Western', alias: ['western', 'oeste'] },
  crimen: { ffn: 18, ao3: 'Crime', alias: ['crimen', 'crime', 'policiaco', 'policíaco'] },
  familia: { ffn: 19, ao3: 'Family', alias: ['familia', 'family'] },
  hurt_comfort: { ffn: 20, ao3: 'Hurt/Comfort', alias: ['hurt/comfort', 'hurt comfort', 'hurt_comfort'] },
  amistad: { ffn: 21, ao3: 'Friendship', alias: ['amistad', 'friendship'] },
  accion: { ao3: 'Action/Adventure', rr: 'action', alias: ['accion', 'acción', 'action'] },
  psicologico: { rr: 'psychological', alias: ['psicologico', 'psicológico', 'psychological'] },
  historico: { rr: 'historical', alias: ['historico', 'histórico', 'historical'] },
  contemporaneo: { rr: 'contemporary', alias: ['contemporaneo', 'contemporáneo', 'contemporary'] }
};

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();

function claveDeGenero(nombre) {
  const buscado = sinTildes(nombre).replace(/[_-]+/g, ' ');
  for (const [clave, g] of Object.entries(GENEROS)) {
    if (sinTildes(clave).replace(/_/g, ' ') === buscado || g.alias.some(a => sinTildes(a).replace(/[_-]+/g, ' ') === buscado)) return clave;
  }
  return null;
}

const lista = (v) => [v].flat().map(x => String(x || '').trim()).filter(Boolean);
const entero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : undefined);

function normalizar(pedido = {}) {
  const f = {};
  const consulta = String(pedido.consulta ?? pedido.query ?? '').trim();
  if (consulta) f.consulta = consulta;
  if (String(pedido.fandom || '').trim()) f.fandom = String(pedido.fandom).trim();
  if (ORDENES.includes(pedido.orden)) f.orden = pedido.orden;
  for (const c of ['minPalabras', 'maxPalabras', 'minCapitulos']) if (entero(pedido[c])) f[c] = entero(pedido[c]);
  for (const [campo, origen] of [['generos', pedido.generos], ['sinGeneros', pedido.sinGeneros]]) {
    const nombres = lista(origen);
    if (nombres.length) f[campo] = nombres.map(n => claveDeGenero(n) || n);
  }
  if (RATINGS.includes(pedido.rating)) f.rating = pedido.rating;
  if (/^[a-z]{2}$/i.test(String(pedido.idioma || ''))) f.idioma = String(pedido.idioma).toLowerCase();
  const estado = ESTADOS.includes(pedido.estado) ? pedido.estado : pedido.completa === true ? 'completa' : undefined;
  if (estado) f.estado = estado;
  if (String(pedido.pareja || '').trim()) f.pareja = String(pedido.pareja).trim();
  const personajes = lista(pedido.personajes);
  if (personajes.length) f.personajes = personajes.slice(0, 4);
  if (pedido.sinCrossovers === true) f.sinCrossovers = true;
  return f;
}

const pedidos = (f) => CAMPOS.filter(c => f[c] !== undefined);

function plan(fuente) {
  const p = { fuente, url: '', web: {}, memoria: [], sinSoporte: [] };
  p.enWeb = (campo, como) => { p.web[campo] = como; };
  p.enMemoria = (campo) => { if (!p.memoria.includes(campo)) p.memoria.push(campo); };
  p.sinPoder = (campo) => { if (!p.sinSoporte.includes(campo)) p.sinSoporte.push(campo); };
  return p;
}

function cerrar(p) {
  const { enWeb, enMemoria, sinPoder, ...resto } = p;
  void enWeb; void enMemoria; void sinPoder;
  return resto;
}

module.exports = { CAMPOS, ORDENES, RATINGS, ESTADOS, GENEROS, claveDeGenero, normalizar, pedidos, plan, cerrar, sinTildes };
