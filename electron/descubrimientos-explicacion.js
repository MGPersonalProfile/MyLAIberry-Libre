const FILTROS = [['fandom', 'fandom'], ['pareja', 'relationship'], ['personajes', 'character'], ['etiquetas', 'freeform'],
  ['idioma', 'language'], ['valoracion', 'rating']];

const ALIAS = {
  en: ['english', 'inglés', 'ingles'], es: ['español', 'espanol', 'spanish'], fr: ['français', 'francais', 'french'],
  de: ['deutsch', 'german'], pt: ['português', 'portugues', 'portuguese'], it: ['italiano', 'italian'], ja: ['日本語', 'japanese'],
  zh: ['中文', 'chinese'], general: ['general audiences', 'general'], adolescente: ['teen and up audiences', 'teen'],
  maduro: ['mature'], explicito: ['explicit', 'explícito']
};

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const palabrasDe = (t) => normalizar(t).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const valoresPedidos = (v) => (Array.isArray(v) ? v : String(v).split(/[,;]/)).map(x => String(x).trim()).filter(Boolean);

function etiquetada(obra, categoria, pedido) {
  const etiquetas = (obra.tags || []).filter(t => t?.category === categoria).map(t => normalizar(t.name));
  const alias = ALIAS[normalizar(pedido).trim()] || [];
  const quiere = palabrasDe(pedido);
  return etiquetas.some(nombre => alias.some(a => normalizar(a) === nombre)
    || (quiere.length > 0 && quiere.every(p => palabrasDe(nombre).includes(p))));
}

function sinVerificar(obra, f = {}) {
  const pendientes = FILTROS.filter(([campo, categoria]) => f[campo]
    && !valoresPedidos(f[campo]).every(v => etiquetada(obra, categoria, v))).map(([campo]) => campo);
  if (f.minPalabras && (!obra.wordCount || obra.palabrasEstimadas)) pendientes.push('palabras');
  if (f.completa && obra.completa === undefined) pendientes.push('completa');
  if (f.orden && (obra.source === 'Wattpad' || (obra.source === 'FanFiction.net' && f.orden === 'recientes'))) pendientes.push('orden');
  return pendientes;
}

function explicarDescubrimiento(obra, { preferencias = {}, perfil = null } = {}) {
  const palabras = Number(obra.wordCount) || 0;
  const estimadas = Boolean(obra.palabrasEstimadas);

  const capitulos = Number(obra.totalChapters) || 0;
  const locales = capitulos ? 0 : (obra.chapterList?.length || 0);
  const etiquetas = (obra.tags || []).map(t => (typeof t === 'object' ? t : { name: String(t) }));

  const motivos = (obra.porque || []).flatMap((n) => {
    const etiqueta = etiquetas.find(t => String(t.name) === String(n));
    if (!etiqueta) return [];
    const enPerfil = perfil ? perfil.get(`${etiqueta.category}|${String(etiqueta.name).toLowerCase().trim()}`) : null;
    if (perfil && !enPerfil) return [];
    return [{ tipo: 'comparte', nivel: 'B', valor: n, ...(enPerfil?.obra ? { evidencia: enPerfil.obra } : {}) }];
  });
  const conocido = [], desconocido = [], advertencias = [];

  if (palabras) conocido.push({ campo: 'palabras', valor: palabras, nivel: estimadas ? 'C' : 'A', ...(estimadas ? { estimado: true } : {}) });
  else desconocido.push('palabras');
  if (capitulos) conocido.push({ campo: 'capitulos', valor: capitulos, nivel: 'A' });
  else if (locales) conocido.push({ campo: 'capitulos', valor: locales, nivel: 'C', local: true });
  else desconocido.push('capitulos');
  if (typeof obra.completa === 'boolean') conocido.push({ campo: 'estado', valor: obra.completa ? 'completa' : 'en curso', nivel: 'A' });
  else desconocido.push('estado');
  if (!String(obra.synopsis || '').trim()) desconocido.push('sinopsis');

  const formato = preferencias.formato || {};
  if (formato.minPalabras > 0) {
    if (!estimadas && palabras >= formato.minPalabras) motivos.push({ tipo: 'minimo-palabras', nivel: 'B', valor: formato.minPalabras });
    else if (!palabras || estimadas) advertencias.push({ tipo: 'sin-verificar', campo: 'palabras' });
  }
  if (formato.minCapitulos > 0) {
    if (capitulos >= formato.minCapitulos) motivos.push({ tipo: 'minimo-capitulos', nivel: 'B', valor: formato.minCapitulos });
    else if (!capitulos) advertencias.push({ tipo: 'sin-verificar', campo: 'capitulos' });
  }
  for (const campo of sinVerificar(obra, obra.propuesta?.filtros)) {
    if (!advertencias.some(a => a.campo === campo)) advertencias.push({ tipo: 'sin-verificar', campo });
  }
  return { motivos, conocido, desconocido, advertencias, coste: { peticionesWeb: 0, llamadasModelo: 0 } };
}

module.exports = { explicarDescubrimiento, sinVerificar };
