const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase();
const L = '[\\p{L}\\p{N}]';
const suelta = (cuerpo) => new RegExp(`(?<!${L})(?:${cuerpo})(?!${L})`, 'iu');

const PALABRAS = {
  'M/M': new RegExp(`(?<!${L})(?:m\\s*/\\s*m|male\\s*/\\s*male|yaoi|danmei|shou?nen[\\s-]?ai|boy(?:['’]?s)?['’]?\\s*love|(?:chico|hombre|homme|mec)s?(?:\\s*/\\s*|\\s[x×]\\s)(?:chico|hombre|homme|mec)s?|homoerotic[oa]?)(?!${L})|耽美|ボーイズラブ|男男`, 'iu'),
  'F/F': new RegExp(`(?<!${L})(?:f\\s*/\\s*f|female\\s*/\\s*female|femslash|shou?jo[\\s-]?ai|girl(?:['’]?s)?['’]?\\s*love|(?:chica|mujer|femme|fille)s?(?:\\s*/\\s*|\\s[x×]\\s)(?:chica|mujer|femme|fille)s?|lesbian[ao]?|lesbic[ao]|lesbienne)(?!${L})|百合|ガールズラブ|女女`, 'iu')
};

const NEGADA = new RegExp(`(?<!${L})(?:no|non|not|sin|without|zero)[\\s-]+(?:a\\s+|an\\s+)?(?:m\\s*/\\s*m|f\\s*/\\s*f|male\\s*/\\s*male|female\\s*/\\s*female|boys?\\s+love|girls?\\s+love|slash|femslash|yaoi|yuri)(?:\\s+(?:fic|fiction|relationships?))?(?!${L})`, 'giu');

const EXACTAS = { 'M/M': /^(?:bl|mm)$/i, 'F/F': /^(?:yuri|gl|ff)$/i };

const PAREJAS = [
  { id: 'drarry', cat: 'M/M', alias: ['drarry', 'harco'], a: ['harry potter', 'harry', 'potter'], b: ['draco malfoy', 'draco', 'malfoy'] },
  { id: 'wolfstar', cat: 'M/M', alias: ['wolfstar'], a: ['remus lupin', 'remus', 'lupin'], b: ['sirius black', 'sirius'] },
  { id: 'tomco', cat: 'M/M', alias: ['tomco'], a: ['marco diaz', 'marco'], b: ['tom lucitor', 'tom'] },
  { id: 'stucky', cat: 'M/M', alias: ['stucky'], a: ['steve rogers', 'steve'], b: ['bucky barnes', 'bucky'] },
  { id: 'sterek', cat: 'M/M', alias: ['sterek'], a: ['stiles stilinski', 'stiles'], b: ['derek hale', 'derek'] },
  { id: 'destiel', cat: 'M/M', alias: ['destiel'], a: ['dean winchester', 'dean'], b: ['castiel', 'cas'] },
  { id: 'johnlock', cat: 'M/M', alias: ['johnlock'], a: ['sherlock holmes', 'sherlock'], b: ['john watson', 'john'] },
  { id: 'sasunaru', cat: 'M/M', alias: ['sasunaru', 'narusasu'], a: ['naruto uzumaki', 'naruto'], b: ['sasuke uchiha', 'sasuke'] },
  { id: 'bakudeku', cat: 'M/M', alias: ['bakudeku', 'katsudeku'], a: ['izuku midoriya', 'izuku', 'deku'], b: ['katsuki bakugou', 'katsuki', 'bakugou', 'bakugo'] },
  { id: 'korrasami', cat: 'F/F', alias: ['korrasami'], a: ['korra'], b: ['asami sato', 'asami'] },
  { id: 'clexa', cat: 'F/F', alias: ['clexa'], a: ['clarke griffin', 'clarke'], b: ['lexa'] },
  { id: 'wayhaught', cat: 'F/F', alias: ['wayhaught'], a: ['waverly earp', 'waverly'], b: ['nicole haught', 'nicole'] },
  { id: 'catradora', cat: 'F/F', alias: ['catradora'], a: ['catra'], b: ['adora'] },
  { id: 'bubbline', cat: 'F/F', alias: ['bubbline'], a: ['marceline'], b: ['princess bubblegum', 'bubblegum'] }
];

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const alt = (nombres) => nombres.map(escapar).join('|');
const UNION = '(?:\\s*/\\s*|\\s[x×+]\\s|\\s*[♥❤]\\ufe0f?\\s*)';
const FANDOMS = { drarry: /harry potter/, wolfstar: /harry potter/, tomco: /star vs|star butterfly|forces of evil/,
  stucky: /marvel|captain america|avengers/, sterek: /teen wolf/, destiel: /supernatural/,
  johnlock: /sherlock/, sasunaru: /naruto/, bakudeku: /my hero academia|boku no hero/,
  korrasami: /korra|avatar/, clexa: /the 100/, wayhaught: /wynonna earp/,
  catradora: /she-ra/, bubbline: /adventure time/ };
for (const p of PAREJAS) {
  p.reAlias = suelta(alt(p.alias));
  p.rePar = new RegExp(`(?<!${L})(?:${alt(p.a)})${UNION}(?:${alt(p.b)})(?!${L})|(?<!${L})(?:${alt(p.b)})${UNION}(?:${alt(p.a)})(?!${L})`, 'iu');
  p.reContexto = new RegExp(`(?:${alt(p.a)})\\s+(?:and|y)\\s+(?:${alt(p.b)})\\s+(?:fall in love|son novios|se enamoran)|(?:${alt(p.b)})\\s+(?:and|y)\\s+(?:${alt(p.a)})\\s+(?:fall in love|son novios|se enamoran)|romance entre (?:${alt(p.a)}) y (?:${alt(p.b)})|romance entre (?:${alt(p.b)}) y (?:${alt(p.a)})`, 'iu');
  p.reAmpRomance = new RegExp(`(?:(?:${alt(p.a)})\\s*&\\s*(?:${alt(p.b)})|(?:${alt(p.b)})\\s*&\\s*(?:${alt(p.a)}))[^.!?\\n]{0,24}\\b(?:romantic|romance|romantico)\\b`, 'iu');
}

function parejasDe(texto, fandom = '') {
  const t = sinAcentos(texto);
  const f = sinAcentos(fandom);
  return t ? PAREJAS.filter(p => p.reAlias.test(t) || ((!f || FANDOMS[p.id].test(f)) && (p.rePar.test(t) || p.reContexto.test(t) || p.reAmpRomance.test(t)))) : [];
}

function lecturaDe({ titulo = '', etiquetas = [], sinopsis = '', fandom = '' }) {
  const categorias = new Set();
  const propios = [titulo, ...etiquetas].map(x => sinAcentos(x).replace(NEGADA, ' '));
  for (const [cat, patron] of Object.entries(PALABRAS)) {
    if (propios.some(x => patron.test(x))) categorias.add(cat);
    if (etiquetas.some(e => EXACTAS[cat].test(sinAcentos(e).trim()))) categorias.add(cat);
  }
  if (propios.some(x => /^(?:slash|slash au|slash fic|slash fiction)$/.test(x.trim()) ||
    /\b(?:romantic[oa]?|romance|pre|mild|explicit)\s*[-/]?\s*slash\b|\bslash\s*[-/]?\s*(?:romance|romantic[oa]?|pairing|relationship)\b/.test(x))) categorias.add('M/M');
  const casilla = etiquetas.some(e => /^(?:f\/m|m\/f|gen)$/i.test(sinAcentos(e).trim()));
  const romanceEnSinopsis = /\b(?:fall in love|son novios|se enamoran|romance entre|romantic|romantico|se besan|kiss|are lovers|son pareja)\b|[♥❤]/iu.test(sinAcentos(sinopsis));
  const parejas = parejasDe([titulo, ...etiquetas, ...(!casilla || romanceEnSinopsis ? [sinopsis] : [])].join(' \n '), fandom);
  parejas.forEach(p => categorias.add(p.cat));
  return { categorias: [...categorias], parejas };
}

const CASILLAS = /^(?:m\/m|f\/m|m\/f|f\/f|gen|multi|other)$/i;
const traeCasilla = (etiquetas) => etiquetas.some(e => CASILLAS.test(sinAcentos(e).trim()));

module.exports = { lecturaDe, parejasDe, traeCasilla, sinAcentos, PAREJAS, PALABRAS };
