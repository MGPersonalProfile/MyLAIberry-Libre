const { GENEROS, normalizar, plan, cerrar } = require('./modelo.js');
const { resolverParejaAO3 } = require('./parejas-ao3.js');

const ORDEN = { popularidad: 'kudos_count', recientes: 'revised_at', publicadas: 'created_at', palabras: 'word_count', relevancia: '_score' };
const RATING = { general: 10, adolescente: 11, maduro: 12, explicito: 13 };

const IDIOMAS = ['en', 'es', 'fr', 'de', 'it', 'ru', 'zh', 'ja', 'ko', 'pl', 'nl', 'id', 'tr', 'vi', 'uk', 'sv', 'fi', 'da', 'cs', 'hu', 'ca', 'he', 'ar', 'th'];

function palabras(f, p, q) {
  const { minPalabras: min, maxPalabras: max } = f;
  if (!min && !max) return;
  q.set('work_search[word_count]', min && max ? `${min}-${max}` : min ? `>${min}` : `<${max}`);
  if (min) p.enWeb('minPalabras', `word_count ${q.get('work_search[word_count]')}`);
  if (max) p.enWeb('maxPalabras', `word_count ${q.get('work_search[word_count]')}`);
}

function generos(f, p, q) {
  const conEtiqueta = (f.generos || []).map(g => GENEROS[g]?.ao3).filter(Boolean);
  if (conEtiqueta.length) {
    q.set('work_search[freeform_names]', conEtiqueta.join(','));
    p.enWeb('generos', `freeform_names=${conEtiqueta.join(',')}`);
  }
  if ((f.generos || []).length > conEtiqueta.length) p.enMemoria('generos');
  if (f.sinGeneros) p.enMemoria('sinGeneros');
}

function traducirAO3(pedido, { pagina = 1 } = {}) {
  const f = normalizar(pedido);
  const p = plan('AO3');
  const q = new URLSearchParams();
  q.set('work_search[query]', f.consulta || '');
  if (f.consulta) p.enWeb('consulta', 'query');
  if (f.fandom) { q.set('work_search[fandom_names]', f.fandom); p.enWeb('fandom', `fandom_names=${f.fandom}`); }
  if (f.pareja) {
    const { canonica } = resolverParejaAO3(f.pareja);
    q.set('work_search[relationship_names]', canonica);
    p.enWeb('pareja', `relationship_names=${canonica}`);
    p.enMemoria('pareja');
  }
  if (f.personajes) { q.set('work_search[character_names]', f.personajes.join(',')); p.enWeb('personajes', `character_names=${f.personajes.join(',')}`); }
  generos(f, p, q);
  if (f.rating) { q.set('work_search[rating_ids]', String(RATING[f.rating])); p.enWeb('rating', `rating_ids=${RATING[f.rating]}`); }
  if (f.idioma) { if (IDIOMAS.includes(f.idioma)) { q.set('work_search[language_id]', f.idioma); p.enWeb('idioma', `language_id=${f.idioma}`); } else p.enMemoria('idioma'); }
  if (f.estado) { q.set('work_search[complete]', f.estado === 'completa' ? 'T' : 'F'); p.enWeb('estado', `complete=${q.get('work_search[complete]')}`); }
  palabras(f, p, q);
  if (f.minCapitulos) p.enMemoria('minCapitulos');
  if (f.sinCrossovers) { q.set('work_search[crossover]', 'F'); p.enWeb('sinCrossovers', 'crossover=F'); }
  q.set('work_search[sort_column]', ORDEN[f.orden] || 'kudos_count');
  if (f.orden) p.enWeb('orden', `sort_column=${ORDEN[f.orden]}`);
  if (pagina > 1) q.set('page', String(pagina));
  p.url = `https://archiveofourown.org/works/search?${q}`;
  return cerrar(p);
}

module.exports = { traducirAO3, ORDEN_AO3: ORDEN };
