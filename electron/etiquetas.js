const FANDOM = 'fandom';
const PERSONAJE = 'character';
const RELACION = 'relationship';
const GENERO = 'genre';
const LIBRE = 'freeform';
const CLASIFICACION = 'rating';
const AVISO = 'warning';
const CATEGORIA = 'category';
const IDIOMA = 'language';

const ALIAS = {
  fandom: FANDOM, fandoms: FANDOM,
  character: PERSONAJE, characters: PERSONAJE,
  relationship: RELACION, relationships: RELACION, ship: RELACION, ships: RELACION,
  freeform: LIBRE, freeforms: LIBRE, 'additional tags': LIBRE, 'additional tag': LIBRE,
  genre: GENERO, genres: GENERO,
  rating: CLASIFICACION, ratings: CLASIFICACION,
  warning: AVISO, warnings: AVISO,
  category: CATEGORIA, categories: CATEGORIA,
  language: IDIOMA, languages: IDIOMA
};

function categoriaCanonica(categoria, fuente = '') {
  const cruda = String(categoria || '').toLowerCase().trim();
  if (!cruda) return LIBRE;

  if (cruda === 'tag' || cruda === 'tags') {
    return /fanfiction/i.test(fuente) ? GENERO : LIBRE;
  }
  return ALIAS[cruda] || cruda;
}

function limpiarNombreFandom(nombre) {
  const trozos = String(nombre || '').split('|').map(s => s.trim()).filter(Boolean);
  const elegido = trozos[trozos.length - 1] || String(nombre || '');

  return elegido

    .replace(/\s*\([^)]*\)\s*$/, '')

    .replace(/\s+-\s+(?:[A-Z]\.\s*)+[A-Z][\w'-]+$/, '')
    .replace(/\s+-\s+[A-Z][\w'-]+\s+[A-Z][\w'-]+$/, '')

    .replace(/\s+-\s+(Fandom|Character|Relationship|Freeform)s?$/i, '')
    .trim();
}

function normalizarEtiquetas(tags = [], fuente = '') {
  const vistas = new Set();
  const salida = [];

  for (const t of tags) {
    if (!t || !t.name) continue;
    const category = categoriaCanonica(t.category, fuente);

    const name = category === FANDOM
      ? limpiarNombreFandom(t.name)
      : String(t.name).trim();
    if (!name) continue;

    const clave = `${category}|${name.toLowerCase()}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push({ ...t, name, category });
  }

  return salida;
}

const TERMINADAS = new Set(['completed', 'complete', 'completa', 'completo', 'finalizado', 'finished']);
const EN_MARCHA = new Set(['ongoing', 'inactive', 'hiatus', 'dropped', 'stub', 'en curso', 'pausado', 'abandonado']);

function estadoACompleta(texto) {
  const t = String(texto || '').toLowerCase().trim();
  if (!t) return undefined;
  if (TERMINADAS.has(t)) return true;
  if (EN_MARCHA.has(t)) return false;
  return undefined;
}

function completaDeEtiquetas(etiquetas = []) {
  for (const e of etiquetas) {
    const v = estadoACompleta(e);
    if (v !== undefined) return v;
  }
  return undefined;
}

const TERMINADA_EN_TITULO = /[[(]\s*(complete|completed|completado|completa|finished|terminad[ao]|end|fin)\s*[\])]/i;

function completaDelTitulo(titulo) {
  return TERMINADA_EN_TITULO.test(String(titulo || '')) ? true : undefined;
}

module.exports = {
  estadoACompleta,
  completaDeEtiquetas,
  completaDelTitulo,
  categoriaCanonica,
  limpiarNombreFandom,
  normalizarEtiquetas,
  ALIAS,
  FANDOM, PERSONAJE, RELACION, GENERO, LIBRE, CLASIFICACION, AVISO, CATEGORIA, IDIOMA
};
