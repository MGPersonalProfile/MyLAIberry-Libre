const GENEROS = [
  { nombre: 'Humor',        frase: 'a funny, lighthearted story full of jokes, banter, teasing and comedic misunderstandings that make the reader laugh' },
  { nombre: 'Romance',      frase: 'a love story about two people falling for each other, with longing glances, blushing, confessions and first kisses' },
  { nombre: 'Angst',        frase: 'an emotionally painful story about anguish, guilt, self-loathing, despair and characters breaking down inside' },
  { nombre: 'Tragedy',      frase: 'a devastating story about death, irreparable loss, grief and mourning, where things end badly' },
  { nombre: 'Action',       frase: 'a fast-paced story of fights, battles, chases, weapons and physical combat between opponents' },
  { nombre: 'Adventure',    frase: 'a journey across unknown lands, exploration, quests, danger and discovery far from home' },
  { nombre: 'Fantasy',      frase: 'a story of magic, spells, wizards, mythical creatures and imaginary kingdoms' },
  { nombre: 'Sci-Fi',       frase: 'a story of advanced technology, spaceships, artificial intelligence, distant planets and the future' },
  { nombre: 'Mystery',      frase: 'a puzzling story of investigation, clues, secrets, suspects and a truth slowly uncovered' },
  { nombre: 'Horror',       frase: 'a frightening story of dread, monsters, darkness, gore and characters terrified for their lives' },
  { nombre: 'Drama',        frase: 'a serious story about difficult relationships, arguments, betrayal and personal conflict between people' },
  { nombre: 'Friendship',   frase: 'a story about companionship, loyalty between friends, teamwork and standing by each other' },
  { nombre: 'Family',       frase: 'a story about parents and children, siblings, adoption and the bonds inside a household' },
  { nombre: 'Hurt/Comfort', frase: 'a story where a character is badly hurt or suffering and someone else takes care of them and comforts them' },
  { nombre: 'Slice of Life', frase: 'a quiet everyday story of ordinary routines, cooking, school, small domestic moments and nothing dramatic' }
];

function calcularReferencias(puntuacionesPorObra) {
  const refs = {};
  for (const genero of GENEROS) {
    const valores = puntuacionesPorObra
      .map(p => p.find(x => x.nombre === genero.nombre)?.puntuacion)
      .filter(v => typeof v === 'number');
    if (!valores.length) continue;

    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;

    refs[genero.nombre] = { media, desviacion: Math.max(Math.sqrt(varianza), 0.01) };
  }
  return refs;
}

function tipificar(puntuaciones, referencias) {
  return puntuaciones
    .map(p => {
      const r = referencias?.[p.nombre];
      if (!r) return { ...p, z: 0 };
      return { ...p, z: (p.puntuacion - r.media) / r.desviacion };
    })
    .sort((a, b) => b.z - a.z);
}

const LISTON_ACEPTAR = 1.2;

const LISTON_PROPONER = 0.7;

const TOPE_POR_OBRA = 3;

function coseno(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function trocear(texto, { tope = 8, largo = 600 } = {}) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpio) return [];

  const frases = limpio.split(/(?<=[.!?…"”])\s+/).filter(f => f.length > 25);
  if (!frases.length) return [limpio.slice(0, largo)];

  const conDialogo = (f) => /["“”'']|—|--/.test(f);

  const bloques = [];
  let actual = '';
  let tieneDialogo = false;

  for (const f of frases) {
    if (actual.length + f.length > largo && actual) {
      bloques.push({ texto: actual.trim(), dialogo: tieneDialogo });
      actual = '';
      tieneDialogo = false;
    }
    actual += f + ' ';
    if (conDialogo(f)) tieneDialogo = true;
  }
  if (actual.trim()) bloques.push({ texto: actual.trim(), dialogo: tieneDialogo });

  const conD = bloques.filter(b => b.dialogo);
  const sinD = bloques.filter(b => !b.dialogo);
  return [...conD, ...sinD].slice(0, tope).map(b => b.texto);
}

function senalDeRisa(texto) {
  const t = String(texto || '');
  if (!t.length) return 0;

  const risas = (t.match(/\b(?:ha){2,}\b|\b(?:he){2,}\b|\b(?:ja){2,}\b|\blaugh(?:ed|ing|s)?\b|\bgiggl(?:ed|ing|es)?\b|\bsnort(?:ed|ing)?\b|\bchuckl(?:ed|ing|es)?\b/gi) || []).length;
  const palabras = t.split(/\s+/).length;
  if (palabras < 200) return 0;

  const porMil = (risas / palabras) * 1000;

  return Math.min(1, porMil / 3);
}

function puntuar(vectoresTrozos, vectoresGeneros, { textoCompleto = '' } = {}) {
  if (!vectoresTrozos?.length || !vectoresGeneros?.length) return [];

  const risa = senalDeRisa(textoCompleto);

  return GENEROS.map((genero, i) => {
    const vg = vectoresGeneros[i];
    const puntos = vectoresTrozos.map(vt => coseno(vt, vg)).sort((a, b) => b - a);
    const mejores = puntos.slice(0, 3);
    let puntuacion = mejores.reduce((s, x) => s + x, 0) / mejores.length;

    if (genero.nombre === 'Humor' && risa > 0) {
      puntuacion += risa * 0.03;
    }

    return { nombre: genero.nombre, puntuacion };
  }).sort((a, b) => b.puntuacion - a.puntuacion);
}

function decidir(tipificadas, { descartados = [], aceptar = LISTON_ACEPTAR, proponer = LISTON_PROPONER } = {}) {
  const fuera = new Set(descartados.map(d => String(d).toLowerCase()));
  const validos = tipificadas
    .filter(p => !fuera.has(p.nombre.toLowerCase()))
    .slice(0, TOPE_POR_OBRA);

  return {
    seguros: validos.filter(p => p.z >= aceptar),
    propuestos: validos.filter(p => p.z >= proponer && p.z < aceptar)
  };
}

module.exports = {
  GENEROS,
  trocear,
  puntuar,
  calcularReferencias,
  tipificar,
  decidir,
  senalDeRisa,
  coseno,
  LISTON_ACEPTAR,
  LISTON_PROPONER,
  TOPE_POR_OBRA
};
