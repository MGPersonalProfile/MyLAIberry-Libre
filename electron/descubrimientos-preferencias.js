const { categoriaCanonica, FANDOM, GENERO, LIBRE } = require('./etiquetas');
const normal = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
const fandomsDe = o => [...new Set((o.tags || []).filter(t => categoriaCanonica(t.category) === FANDOM)
  .flatMap(t => /fanfiction|^ffn$/i.test(o.source || '') ? String(t.name || '').split(/\s+&\s+/) : [t.name]).filter(Boolean))];

function claveAutor(o) {
  if (o.autorUrl) {
    try {
      const u = new URL(o.autorUrl);
      const ruta = u.pathname.match(/^\/(?:u|profile)\/\d+/i)?.[0] || u.pathname.replace(/\/$/, '');
      return `url:${u.hostname.toLowerCase().replace(/^www\./, '')}${ruta.toLowerCase()}`;
    } catch {  }
  }
  return `${normal(o.source)}|${normal(o.author)}`;
}

function coincideFandom(o, nombre) {
  const n = normal(nombre);
  return !!n && fandomsDe(o).some(f => normal(f) === n);
}

function cortaDeMas(o, formato = {}) {
  const palabras = Number(o.wordCount) || 0, capitulos = Number(o.totalChapters || o.chapterList?.length) || 0;
  return (formato.minPalabras > 0 && palabras > 0 && palabras < formato.minPalabras)
    || (formato.minCapitulos > 0 && capitulos > 0 && capitulos < formato.minCapitulos);
}

const ROMANCE = /^(romance|fluff|pure fluff|fluff and smut|tooth-rotting fluff|romantic comedy|slow burn romance)$/i;
const TRAMA = /\b(action|adventure|plot|mystery|thriller|war|horror|crime|politics)\b/i;
function romanceCentral(o) {
  const de = (cat) => (o.tags || []).filter(t => categoriaCanonica(t.category) === cat).map(t => String(t.name || t).trim());
  const generos = de(GENERO), libres = de(LIBRE);
  if (/^romance$/i.test(generos[0] || '')) return true;
  return libres.some(n => ROMANCE.test(n)) && ![...generos, ...libres].some(n => TRAMA.test(n));
}

function oculta(o, preferencias = {}) {
  return cortaDeMas(o, preferencias.formato) || (preferencias.formato?.romance === 'ocultar' && romanceCentral(o)) || (preferencias.autores || []).some(a => a.clave === claveAutor(o)
    || (!o.autorUrl && normal(a.nombre) === normal(o.author) && normal(a.fuente) === normal(o.source)))
    || (preferencias.fandoms || []).some(f => coincideFandom(o, f));
}

const CORTA_PALABRAS = 20000, CORTA_CAPITULOS = 3;
function rasgosDeFormato(o) {
  const palabras = Number(o.wordCount) || 0, capitulos = Number(o.totalChapters || o.chapterList?.length) || 0;
  const rasgos = [];
  if ((palabras > 0 && palabras < CORTA_PALABRAS) || (capitulos > 0 && capitulos <= CORTA_CAPITULOS)) rasgos.push('corta');
  if (romanceCentral(o)) rasgos.push('romance');
  return rasgos;
}

const MINIMO_PARA_APRENDER_FORMATO = 10;
function pesoDelFormato(todas) {
  const descartes = todas.filter(o => o.origen === 'descartada' && !o.descarteMasivo);
  const suyas = todas.filter(o => o.origen === 'propia');
  const peso = new Map();
  if (descartes.length < MINIMO_PARA_APRENDER_FORMATO || suyas.length < MINIMO_PARA_APRENDER_FORMATO) return peso;
  for (const rasgo of ['corta', 'romance']) {
    const enDescartes = descartes.filter(o => rasgosDeFormato(o).includes(rasgo)).length;
    const enSuyas = suyas.filter(o => rasgosDeFormato(o).includes(rasgo)).length;
    const veces = ((enDescartes + 1) / (descartes.length + 2)) / ((enSuyas + 1) / (suyas.length + 2));
    if (veces > 1) peso.set(rasgo, veces - 1);
  }
  return peso;
}

function rechazoAcumulado(todas) {
  const autores = new Map(), fandoms = new Map();
  for (const o of todas) {
    if (o.origen !== 'descartada' || o.descarteMasivo) continue;
    const k = claveAutor(o);
    if (normal(o.author)) autores.set(k, (autores.get(k) || 0) + 1);
    const fs = fandomsDe(o);
    for (const f of fs) fandoms.set(normal(f), (fandoms.get(normal(f)) || 0) + 1 / fs.length);
  }
  return { autores, fandoms, formato: pesoDelFormato(todas) };
}

function ajustarDescubrimientos(ordenadas, todas, preferencias = {}) {
  const rechazo = rechazoAcumulado(todas);
  return ordenadas.filter(o => !oculta(o, preferencias)).map(o => {
    const porFormato = rasgosDeFormato(o).reduce((n, r) => n + (rechazo.formato.get(r) || 0), 0);
    const veces = (rechazo.autores.get(claveAutor(o)) || 0)
      + fandomsDe(o).reduce((n, f) => n + (rechazo.fandoms.get(normal(f)) || 0), 0) + porFormato;

    const penalizacion = preferencias.aprender === false ? 0 : veces;

    const hundida = preferencias.formato?.romance === 'hundir' && romanceCentral(o);
    return { ...o, afinidad: ((o.afinidad || 0) + 1) / (1 + penalizacion) / (hundida ? 3 : 1), menosPorDescartes: penalizacion > 0,
      ...(penalizacion > 0 && porFormato > 0 ? { menosPorFormato: true } : {}),
      ...(hundida ? { menosPorRomance: true } : {}) };
  }).sort((a, b) => b.afinidad - a.afinidad);
}

module.exports = { normal, fandomsDe, claveAutor, coincideFandom, oculta, ajustarDescubrimientos, romanceCentral, rasgosDeFormato, pesoDelFormato };
