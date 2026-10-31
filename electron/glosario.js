const MARCA = /\{\{(\d+)\}\}/g;

const CATEGORIAS_DE_NOMBRE = new Set([
  'character', 'relationship', 'fandom',
  'characters', 'relationships', 'fandoms', 'ship'
]);

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sembrarDesdeEtiquetas(tags = []) {
  const terminos = new Set();

  for (const t of tags) {
    if (!CATEGORIAS_DE_NOMBRE.has(t.category)) continue;

    const sinParentesis = String(t.name).replace(/\s*\([^)]*\)\s*$/, '');

    for (const trozo of sinParentesis.split(/[/|&]/)) {
      const nombre = trozo.trim()

        .replace(/\s*\([^)]*\)\s*$/, '')

        .replace(/\s+-\s+(?:[A-Z]\.\s*)+[A-Z][\w'-]+$/, '')
        .replace(/\s+-\s+[A-Z][\w'-]+\s+[A-Z][\w'-]+$/, '')
        .trim();

      if (nombre.length < 3 || nombre.length > 40) continue;

      if (!/^[\p{Lu}]/u.test(nombre)) continue;

      terminos.add(nombre);
    }
  }

  return [...terminos].map(termino => ({ termino, accion: 'no-traducir' }));
}

function apariciones(texto, termino) {
  const entero = new RegExp(`\\b${escapar(termino)}\\b`, 'gi');
  const directas = (String(texto).match(entero) || []).length;
  if (directas > 0) return directas;

  const partes = termino.split(/\s+/).filter(p => p.length >= 4);
  if (partes.length < 2) return 0;

  return Math.max(...partes.map(p => {
    const re = new RegExp(`\\b${escapar(p)}\\b`, 'gi');
    return (String(texto).match(re) || []).length;
  }));
}

const SENALES_DE_ETIQUETA = [
  / - Character$/i,
  / - Relationship$/i,
  /\(.*\)\s*-\s*/,
  /\b(Everyone|Others?|Various|Original|Minor|Background|Assorted|Multiple)\b/i,
  /\bCharacters?\b/i
];

function filtrarConTexto(glosario = [], texto = '') {
  const salida = [];
  const yaEsta = new Set();

  for (const g of glosario) {

    const limpio = g.termino
      .replace(/\s*-\s*(Character|Relationship)s?$/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .trim();

    const eraEtiqueta = limpio !== g.termino;
    const sirve = limpio.length >= 3 && (
      eraEtiqueta
        ? !!(texto && apariciones(texto, limpio) > 0)
        : !SENALES_DE_ETIQUETA.some(re => re.test(limpio))
    );

    if (!sirve || yaEsta.has(limpio.toLowerCase())) continue;
    yaEsta.add(limpio.toLowerCase());
    salida.push({ ...g, termino: limpio });
  }

  return salida;
}

const COMUNES = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'if', 'so', 'then', 'when', 'while',
  'he', 'she', 'it', 'they', 'we', 'you', 'i', 'his', 'her', 'their', 'its',
  'this', 'that', 'these', 'those', 'there', 'here', 'what', 'who', 'why',
  'how', 'not', 'no', 'yes', 'well', 'just', 'like', 'even', 'still', 'only',
  'god', 'lord', 'sir', 'mister', 'miss', 'chapter', 'part', 'end', 'author',
  'note', 'notes', 'one', 'two', 'three', 'first', 'last', 'next', 'after',
  'before', 'because', 'though', 'although', 'however', 'maybe', 'perhaps',
  'okay', 'ok', 'oh', 'ah', 'hey', 'yeah', 'nothing', 'something', 'everything',
  'someone', 'anyone', 'everyone', 'nobody', 'now', 'never', 'always', 'once',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',

  'watching', 'looking', 'thinking', 'holding', 'standing', 'walking',
  'turning', 'taking', 'getting', 'making', 'coming', 'going', 'being',
  'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'inside', 'outside', 'instead', 'without', 'within', 'behind', 'beyond',
  'finally', 'suddenly', 'slowly', 'quickly', 'somehow', 'anyway', 'again',

  'i\'m', 'i’m', 'i\'ll', 'i’ll', 'i\'ve', 'i’ve', 'i\'d', 'i’d',
  'yup', 'yep', 'nope', 'huh', 'hmm', 'uh', 'um', 'er', 'ha', 'heh',

  'policy', 'privacy', 'terms', 'service', 'content', 'dmca', 'archive',
  'organization', 'transformative', 'works', 'support', 'contact', 'site',
  'tos', 'faq', 'donate', 'copyright', 'legal', 'guidelines', 'skip',
  'our', 'own', 'united', 'states', 'main', 'navigation', 'menu', 'log',

  'mrs', 'mr', 'ms', 'dr', 'prof', 'san', 'kun', 'chan', 'sama', 'sensei',

  'good', 'bad', 'great', 'better', 'best', 'right', 'wrong', 'true', 'false'
]);

function nombresDelTexto(texto, { minimoApariciones = 3, tope = 20 } = {}) {
  if (!texto || texto.length < 500) return [];

  const cuenta = new Map();

  for (const frase of String(texto).split(/(?<=[.!?…])\s+|\n+/)) {
    const palabras = frase.trim().split(/\s+/);

    palabras.forEach((cruda, i) => {
      if (i === 0) return;

      const anterior = palabras[i - 1] || '';
      if (/["“«]$/.test(anterior) || /[.!?…]$/.test(anterior)) return;

      const palabra = cruda
        .replace(/^[^\p{L}]+/u, '')

        .replace(/['’]s$/u, '')
        .replace(/['’]$/u, '')
        .replace(/[^\p{L}'’-]+$/u, '');
      if (palabra.length < 3 || palabra.length > 25) return;
      if (!/^\p{Lu}/u.test(palabra)) return;
      if (/^\p{Lu}+$/u.test(palabra)) return;
      if (COMUNES.has(palabra.toLowerCase())) return;

      cuenta.set(palabra, (cuenta.get(palabra) || 0) + 1);
    });
  }

  return [...cuenta.entries()]
    .filter(([, n]) => n >= minimoApariciones)
    .sort((a, b) => b[1] - a[1])
    .slice(0, tope)
    .map(([termino]) => termino);
}

function sembrar(tags = [], texto = '', quitados = []) {
  const fuera = new Set(quitados.map(t => t.toLowerCase()));

  const deEtiquetas = filtrarConTexto(sembrarDesdeEtiquetas(tags), texto);
  const yaEstan = new Set(deEtiquetas.map(g => g.termino.toLowerCase()));

  const delTexto = nombresDelTexto(texto)
    .filter(n => !yaEstan.has(n.toLowerCase()))
    .map(termino => ({ termino, accion: 'no-traducir', origen: 'texto' }));

  return [...deEtiquetas, ...delTexto].filter(g => !fuera.has(g.termino.toLowerCase()));
}

function proteger(texto, glosario = []) {
  if (!glosario.length) return { texto, tabla: [] };

  const ordenados = [...glosario].sort((a, b) => b.termino.length - a.termino.length);

  const tabla = [];
  let salida = texto;

  for (const entrada of ordenados) {
    const re = new RegExp(`\\b${escapar(entrada.termino)}\\b`, 'g');
    if (!re.test(salida)) continue;
    re.lastIndex = 0;

    const indice = tabla.length;

    tabla.push(entrada.accion === 'fijar' && entrada.valor ? entrada.valor : entrada.termino);
    salida = salida.replace(re, `{{${indice}}}`);
  }

  return { texto: salida, tabla };
}

function restaurar(texto, tabla = []) {
  if (!tabla.length) return texto;
  return String(texto).replace(MARCA, (entera, n) => {
    const valor = tabla[Number(n)];
    return valor === undefined ? entera : valor;
  });
}

function marcasPerdidas(original, traducido) {
  const cuenta = (s) => new Set(String(s).match(MARCA) || []).size;
  return cuenta(original) - cuenta(traducido);
}

module.exports = {
  sembrar,
  filtrarConTexto,
  nombresDelTexto,
  apariciones,
  sembrarDesdeEtiquetas,
  proteger,
  restaurar,
  marcasPerdidas,
  CATEGORIAS_DE_NOMBRE
};
