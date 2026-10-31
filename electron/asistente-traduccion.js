const { proteger, restaurar } = require('./glosario.js');

const COMO_ESCRIBIR_UNA_REGLA =
  'Escribe la regla en una de estas dos formas para que el traductor pueda obedecerla: ' +
  '«no traduzcas X» (deja el término tal cual) o «traduce X como Y» (fija la palabra). ' +
  'X es UN término concreto: «los nombres propios» o «los honoríficos» son categorías y el traductor no sabe cuáles son; ' +
  'para eso, pon una regla por nombre (pregúntale cuáles si no los ha dicho). ' +
  'Cualquier otra cosa se guarda, pero el traductor automático de la aplicación no puede aplicarla.';

const CATEGORIA = /^(?:(?:todos|todas)\s+)?(?:los|las|el|la|all|any|the|cualquier|ning[uú]n|ninguna)\s+(?:\S+\s+){0,2}?(?:nombres?|palabras?|t[eé]rminos?|t[ií]tulos?|honor[ií]ficos?|apellidos?|lugares|sitios|hechizos?|t[eé]cnicas?|habilidades|ataques|rangos?|names?|words?|terms?|titles?|honorifics?|places?|spells?|skills?)\b/i;

const SIN_TRADUCIR = [
  /^(?:no\s+traduzcas|no\s+traducir|deja(?:r)?\s+sin\s+traducir|mant[eé]n(?:er)?|conserva(?:r)?|respeta(?:r)?)\s+(.+)$/i,
  /^(.+?)\s+(?:no\s+se\s+traduce|sin\s+traducir|tal\s+cual)$/i
];

const FIJAR = [
  /^traduce\s+(.+?)\s+(?:como|por)\s+(.+)$/i,
  /^(.+?)\s*(?:=>|->|=)\s*(.+)$/
];

function limpiar(s) {
  return String(s || '').trim().replace(/^[«"'¡¿(\[]+|[»"'.,;:!?)\]]+$/g, '').trim()

    .replace(/^(?:la\s+palabra|el\s+t[eé]rmino|el\s+nombre|the\s+(?:word|term|name))\s+/i, '')
    .replace(/^[«"'¡¿(\[]+|[»"'.,;:!?)\]]+$/g, '').trim();
}

function leerRegla(texto) {
  const t = String(texto || '').trim();
  if (!t) return { tipo: 'libre', texto: t };

  for (const re of SIN_TRADUCIR) {
    const m = t.match(re);
    const termino = m && limpiar(m[1]);
    if (termino && CATEGORIA.test(termino)) return { tipo: 'libre', texto: t, categoria: termino };
    if (termino) return { tipo: 'no-traducir', termino, texto: t };
  }

  for (const re of FIJAR) {
    const m = t.match(re);
    const termino = m && limpiar(m[1]);
    const valor = m && limpiar(m[2]);

    if (termino && valor && termino.length <= 60 && valor.length <= 60 && !CATEGORIA.test(termino)) {
      return { tipo: 'fijar', termino, valor, texto: t };
    }
  }

  return { tipo: 'libre', texto: t };
}

function reglasDe(estado, workId) {
  const todas = estado?.translationRules || [];
  return [
    ...todas.filter(r => r.workId === 'global'),
    ...(workId ? todas.filter(r => String(r.workId) === String(workId)) : [])
  ];
}

function glosarioDeReglas(reglas = []) {
  const porTermino = new Map();
  for (const regla of reglas) {
    const leida = leerRegla(regla.text ?? regla);
    if (leida.tipo === 'libre') continue;
    porTermino.set(leida.termino.toLowerCase(), leida.tipo === 'fijar'
      ? { termino: leida.termino, accion: 'fijar', valor: leida.valor, origen: 'regla' }
      : { termino: leida.termino, accion: 'no-traducir', origen: 'regla' });
  }
  return [...porTermino.values()];
}

function aparece(texto, termino) {
  const escapado = String(termino).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapado}\\b`, 'i').test(texto);
}

function reglasNoAplicables(reglas = []) {
  return reglas.filter(r => leerRegla(r.text ?? r).tipo === 'libre').map(r => r.text ?? r);
}

async function traducirConReglas({ texto, reglas = [], glosario = [], traducir }) {
  const original = String(texto || '');
  if (!original) throw new Error('Ese pasaje no trae texto.');

  const entradas = [...glosario, ...glosarioDeReglas(reglas)];
  const { texto: marcado, tabla } = proteger(original, entradas);
  const traducido = restaurar(await traducir(marcado), tabla);

  return {
    original,
    traducido,

    aplicadas: entradas.filter(e => aparece(original, e.termino)).map(e => e.termino),
    noAplicables: reglasNoAplicables(reglas)
  };
}

function glosarioConGenerales(propio = [], reglas = []) {
  const generales = (reglas || []).filter(r => r.workId === 'global');
  if (!generales.length) return propio;
  const ya = new Set(propio.map(g => String(g.termino).toLowerCase()));
  return [...propio, ...glosarioDeReglas(generales).filter(g => !ya.has(String(g.termino).toLowerCase()))];
}

module.exports = {
  COMO_ESCRIBIR_UNA_REGLA, leerRegla, reglasDe, glosarioDeReglas, glosarioConGenerales,
  reglasNoAplicables, traducirConReglas
};
