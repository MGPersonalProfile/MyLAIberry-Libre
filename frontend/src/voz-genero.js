const F = 'f';
const M = 'm';

const PRONOMBRE = new Map([['ella', F], ['él', M], ['she', F], ['he', M]]);

const SUSTANTIVOS = new Map([
  ...['chica', 'mujer', 'muchacha', 'niña', 'señora', 'señorita', 'madre', 'abuela', 'hermana', 'tía',
    'reina', 'princesa', 'anciana', 'doncella', 'profesora', 'doctora', 'maestra', 'dama',
    'rubia', 'morena', 'pelirroja', 'bruja', 'chiquilla', 'jefa', 'capitana', 'girl', 'woman', 'lady',
    'mother', 'grandmother', 'sister', 'aunt', 'queen', 'princess', 'witch', 'maid', 'mom', 'mum',
    'daughter', 'wife', 'girlfriend'].map(p => [p, F]),
  ...['chico', 'hombre', 'muchacho', 'niño', 'señor', 'padre', 'abuelo', 'hermano', 'tío', 'rey',
    'príncipe', 'anciano', 'profesor', 'doctor', 'maestro', 'caballero', 'rubio', 'moreno', 'pelirrojo',
    'brujo', 'mago', 'chiquillo', 'jefe', 'capitán', 'boy', 'man', 'guy', 'gentleman', 'lord',
    'father', 'grandfather', 'brother', 'uncle', 'king', 'prince', 'wizard', 'dad', 'son', 'husband',
    'boyfriend'].map(p => [p, M])
]);

const TRATAMIENTOS = new Map([
  ...['señora', 'señorita', 'doña', 'sra', 'srta', 'lady', 'miss', 'mrs', 'ms', 'madame', 'reina',
    'princesa', 'tía', 'queen', 'princess', 'aunt'].map(p => [p, F]),
  ...['señor', 'don', 'sr', 'sir', 'lord', 'mr', 'rey', 'príncipe', 'tío', 'king', 'prince',
    'uncle'].map(p => [p, M])
]);

const ADJ_F = new Set(['molesta', 'seria', 'tranquila', 'contenta', 'atenta', 'fría', 'seca', 'harta',
  'quieta', 'lista', 'borracha', 'despierta', 'tensa', 'muda', 'pálida', 'roja']);
const ADJ_M = new Set(['molesto', 'serio', 'tranquilo', 'contento', 'atento', 'frío', 'seco', 'harto',
  'quieto', 'listo', 'borracho', 'despierto', 'tenso', 'mudo', 'pálido', 'rojo']);

const NO_ADJETIVO = new Set(['enseguida', 'rápido', 'seguido', 'medio', 'nada', 'cada', 'vida', 'salida', 'llegada', 'entrada', 'mirada', 'comida',
  'partida', 'bebida', 'demasiado', 'sentido', 'ruido', 'sonido', 'sido', 'pasado', 'lado', 'cuidado',
  'olvido', 'partido', 'estado', 'resultado', 'recado', 'oído', 'apenas']);

export const VERBOS_DE_HABLA = [
  'dijo', 'preguntó', 'respondió', 'gritó', 'susurró', 'murmuró', 'contestó', 'exclamó', 'añadió',
  'replicó', 'insistió', 'explicó', 'comentó', 'admitió', 'protestó', 'gruñó', 'chilló', 'espetó',
  'inquirió', 'musitó', 'masculló', 'bufó', 'suspiró', 'rio', 'rió', 'declaró', 'ordenó', 'pidió',
  'interrumpió', 'continuó', 'advirtió', 'aseguró', 'confesó', 'sollozó', 'balbuceó', 'tartamudeó',
  'jadeó', 'agregó', 'estuvo de acuerdo', 'resopló', 'se quejó', 'se burló', 'bromeó', 'sugirió',
  'propuso', 'repitió', 'corrigió', 'saludó', 'concluyó', 'prosiguió', 'intervino', 'refunfuñó', 'gimió',
  'rugió', 'siseó', 'afirmó', 'objetó', 'señaló', 'observó', 'reconoció', 'cuestionó', 'agrega', 'añade',
  'dice', 'pregunta', 'responde', 'contesta', 'susurra', 'grita', 'murmura',
  'said', 'asked', 'replied', 'shouted', 'whispered', 'muttered', 'answered', 'exclaimed', 'added',
  'called', 'snapped', 'growled', 'hissed', 'yelled', 'screamed', 'murmured', 'sighed', 'laughed',
  'cried', 'demanded', 'insisted', 'explained', 'admitted', 'protested', 'grumbled', 'mumbled',
  'stammered', 'retorted', 'countered', 'continued', 'offered', 'agreed', 'says', 'asks', 'replies',
  'whispers', 'told', 'noted', 'remarked', 'suggested', 'teased', 'groaned', 'grunted', 'chuckled',
  'giggled', 'drawled', 'purred', 'barked', 'murmurs', 'repeated', 'corrected', 'interrupted'
];
const HABLA = `(?:${VERBOS_DE_HABLA.join('|')})`;
const NOMBRE = String.raw`\p{Lu}[\p{L}\p{M}'’-]*`;
const DETERMINANTE = '(?:la|el|una|un|su|mi|tu|aquella|aquel|esa|ese|the|a|an|his|her|my|your|their)';
const PALABRA = String.raw`\p{L}[\p{L}\p{M}'’-]*`;

const RE = {

  pronombreTras: new RegExp(String.raw`\b${HABLA}\s+(ella|él|she|he)(?![\p{L}])`, 'iu'),

  pronombreAntes: new RegExp(String.raw`(?:^|[^\p{L}])(she|he|ella|él)\s+${HABLA}(?![\p{L}])`, 'iu'),

  sustantivoTras: new RegExp(String.raw`\b${HABLA}\s+(${DETERMINANTE})\s+(?:(${PALABRA})\s+)?(${PALABRA})`, 'iu'),

  sustantivoAntes: new RegExp(String.raw`\b${DETERMINANTE}\s+(?:(${PALABRA})\s+)?(${PALABRA})\s+${HABLA}\b`, 'iu'),

  adjetivo: new RegExp(String.raw`\b${HABLA}(?:\s+(?:ella|él|${NOMBRE}(?:\s+${NOMBRE}){0,2}))?\s*,?\s+(\p{Ll}[\p{Ll}\p{M}]*)(?=\s*(?:[.,;:!?…—)]|\s+y\s|$))`, 'u'),
  tratamiento: new RegExp(String.raw`(?:^|[^\p{L}])(${[...TRATAMIENTOS.keys()].join('|')})\.?\s+(${NOMBRE})`, 'giu')
};

function generoDelAdjetivo(palabra) {
  if (!palabra || NO_ADJETIVO.has(palabra)) return null;
  if (ADJ_F.has(palabra) || /(?:ada|ida|osa)$/u.test(palabra)) return F;
  if (ADJ_M.has(palabra) || /(?:ado|ido|oso)$/u.test(palabra)) return M;
  return null;
}

function generoDelSustantivo(palabras) {
  for (const p of palabras) {
    const g = p && SUSTANTIVOS.get(p.toLowerCase());
    if (g) return g;
  }
  return null;
}

export function generoDelInciso(texto) {
  if (!texto) return null;
  const pron = texto.match(RE.pronombreTras)?.[1] || texto.match(RE.pronombreAntes)?.[1];
  if (pron) return PRONOMBRE.get(pron.toLowerCase());
  const tras = texto.match(RE.sustantivoTras);
  if (tras) {
    const g = generoDelSustantivo([tras[3], tras[2]]);
    if (g) return g;
  }
  const antes = texto.match(RE.sustantivoAntes);
  if (antes) {
    const g = generoDelSustantivo([antes[2], antes[1]]);
    if (g) return g;
  }
  return generoDelAdjetivo(texto.match(RE.adjetivo)?.[1]);
}

export function incisoDeUnTercero(texto) {
  if (!texto) return false;
  const tras = texto.match(RE.sustantivoTras);
  if (tras && generoDelSustantivo([tras[3], tras[2]])) return true;
  const antes = texto.match(RE.sustantivoAntes);
  return Boolean(antes && generoDelSustantivo([antes[2], antes[1]]));
}

const PRIMERA = new RegExp(String.raw`(?<![\p{L}])(?:estoy|me\s+siento|me\s+sent[ií]a|me\s+sent[ií]|soy|me\s+qued[eé]|me\s+he\s+quedado|me\s+he\s+sentido|estuve|he\s+estado|me\s+encuentro|me\s+pongo|me\s+puse|me\s+he\s+puesto)\s+(?:(?:muy|tan|m[aá]s|un\s+poco|bastante|algo|demasiado|realmente|totalmente|completamente)\s+)?(\p{Ll}[\p{Ll}\p{M}]*)(?![\p{L}])`, 'giu');
const PRIMERA_F = new Set(['segura', 'sola', 'loca', 'enferma', 'muerta', 'embarazada', 'celosa', 'lista',
  'harta', 'contenta', 'atenta', 'despierta', 'seria', 'tranquila', 'molesta', 'perdida', 'nueva', 'gorda']);
const PRIMERA_M = new Set(['seguro', 'solo', 'loco', 'enfermo', 'muerto', 'celoso', 'listo', 'harto',
  'contento', 'atento', 'despierto', 'serio', 'tranquilo', 'molesto', 'perdido', 'nuevo', 'gordo']);

export function generoEnPrimeraPersona(texto) {
  const votos = { f: 0, m: 0 };
  for (const m of (texto || '').matchAll(PRIMERA)) {
    const palabra = m[1].toLowerCase();
    const g = PRIMERA_F.has(palabra) ? F : PRIMERA_M.has(palabra) ? M : generoDelAdjetivo(palabra);
    if (g) votos[g]++;
  }
  if (votos.f === votos.m) return null;
  return votos.f > votos.m ? F : M;
}

export function generosPorTratamiento(texto) {
  const votos = [];
  for (const m of (texto || '').matchAll(RE.tratamiento)) {
    votos.push([m[2], TRATAMIENTOS.get(m[1].toLowerCase())]);
  }
  return votos;
}

export { F as MUJER, M as HOMBRE, TRATAMIENTOS };

const VOCES_DE_MUJER = /(?<![\p{L}])(?:female|mujer|helena|laura|sabina|elvira|dalia|paulina|m[oó]nica|zira|hazel|susan|linda|heera|catherine|aria|jenny|sonia|libby|ximena|luc[ií]a|elena|paloma|karen|samantha|victoria|moira|tessa|fiona|serena|ana|marisol|paola|abril|irene|emma|ava|allison|michelle|sara|clara|elsa|isabella|nuria)(?![\p{L}])/iu;
const VOCES_DE_HOMBRE = /(?<![\p{L}])(?:male|hombre|pablo|ra[uú]l|jorge|[aá]lvaro|david|mark|george|guy|ryan|daniel|diego|juan|carlos|thomas|alex|fred|rishi|oliver|jaime|enrique|gonzalo|tom[aá]s|christopher|eric|roger|brian|andrew|arthur|gerardo|dario|alonso)(?![\p{L}])/iu;

export function generoDeVoz(voz) {
  const nombre = voz?.name || '';
  if (VOCES_DE_MUJER.test(nombre)) return F;
  if (VOCES_DE_HOMBRE.test(nombre)) return M;
  return null;
}

export function elegirVocesPorGenero(voces, idioma = 'es', prefs = {}, narracion = null) {
  const prefijo = idioma.toLowerCase();
  const delIdioma = voces.filter(v => v.lang.toLowerCase().startsWith(prefijo));
  const elegir = (genero, nombre) => {
    const elegida = delIdioma.find(v => v.name === nombre);
    if (elegida) return elegida;
    const suyas = delIdioma.filter(v => generoDeVoz(v) === genero);
    const orden = [...suyas.filter(v => v.localService), ...suyas.filter(v => !v.localService)];
    return orden.find(v => v !== narracion) || orden[0] || null;
  };
  return { [F]: elegir(F, prefs.vozMujer), [M]: elegir(M, prefs.vozHombre) };
}
