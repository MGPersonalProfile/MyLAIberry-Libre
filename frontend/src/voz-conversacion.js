import { generosPorTratamiento } from './voz-genero.js';

const NOMBRE = String.raw`\p{Lu}[\p{L}\p{M}'’-]*`;
const GESTO = new RegExp(String.raw`^[\s—–\-.,;:]*(${NOMBRE}(?:\s+${NOMBRE}){0,2})\s+\p{Ll}`, 'u');

const ESCENA_NUEVA = 300;

function votar(votos, nombre, genero) {
  if (!nombre || !genero) return;
  const v = votos.get(nombre) || { f: 0, m: 0 };
  v[genero]++;
  votos.set(nombre, v);
}

export function generosDelCapitulo(parrafos) {
  const votos = new Map();
  for (const tramos of parrafos) {
    for (const tramo of tramos) {
      if (tramo.tipo === 'dialogo') votar(votos, tramo.personaje, tramo.genero || tramo.primera);
      else for (const [nombre, genero] of generosPorTratamiento(tramo.texto)) votar(votos, nombre, genero);
    }
  }
  const generos = new Map();
  for (const [nombre, { f, m }] of votos) {
    if (f !== m) generos.set(nombre, f > m ? 'f' : 'm');
  }

  const porCorto = new Map();
  for (const [nombre, g] of [...generos]) {
    const corto = nombre.split(/\s+/u).at(-1);
    if (corto === nombre || votos.has(corto)) continue;
    porCorto.set(corto, [...(porCorto.get(corto) || []), g]);
  }
  for (const [corto, todos] of porCorto) if (todos.every(g => g === todos[0])) generos.set(corto, todos[0]);
  return generos;
}

function hablantesDelCapitulo(parrafos) {
  const vistos = new Set();
  for (const tramos of parrafos) {
    for (const tramo of tramos) if (tramo.tipo === 'dialogo' && tramo.personaje) vistos.add(tramo.personaje);
  }
  return vistos;
}

function delGesto(tramos, conocidos) {
  for (const tramo of tramos) {
    if (tramo.tipo !== 'narracion') continue;
    const nombre = tramo.texto.match(GESTO)?.[1];
    if (nombre && conocidos.has(nombre)) return nombre;
  }
  return null;
}

function porGenero(pareja, genero, generos) {
  if (pareja.length !== 2 || !genero) return null;
  const [a, b] = pareja.map(n => generos.get(n));
  if (!a || !b || a === b) return null;
  return a === genero ? pareja[0] : pareja[1];
}

function deducirHablante({ tramos, pista, pareja, anterior, generos, conocidos }) {
  const hablante = delGesto(tramos, conocidos) || porGenero(pareja, pista, generos);
  if (hablante || !anterior || pareja.length !== 2) return hablante;

  const otro = pareja.find(n => n !== anterior);
  const delOtro = generos.get(otro);
  const delAnterior = generos.get(anterior);
  return !pista || delOtro === pista || (!delOtro && delAnterior && delAnterior !== pista) ? otro : null;
}

function ponerGenero(dialogos, propia, generos) {
  for (const tramo of dialogos) {
    if (tramo.genero) continue;
    const delNombre = tramo.personaje &&
      (generos.get(tramo.personaje) || generos.get(tramo.personaje.split(/\s+/u).at(-1)));
    if (delNombre || propia) tramo.genero = delNombre || propia;
  }
}

export function atribuirConversacion(parrafos) {
  const resultado = parrafos.map(tramos => tramos.map(tramo => ({ ...tramo })));
  const generos = generosDelCapitulo(resultado);
  const conocidos = hablantesDelCapitulo(resultado);
  let pareja = [];
  let anterior = null;

  for (const tramos of resultado) {
    const dialogos = tramos.filter(t => t.tipo === 'dialogo');
    if (!dialogos.length) {
      anterior = null;
      const largo = tramos.reduce((n, t) => n + t.texto.length, 0);
      if (largo > ESCENA_NUEVA) pareja = [];
      continue;
    }

    const propia = dialogos.find(t => t.genero)?.genero || dialogos.find(t => t.primera)?.primera || null;
    if (dialogos.some(t => t.tercero)) {
      for (const tramo of dialogos) if (!tramo.genero && propia) tramo.genero = propia;
      anterior = null;
      continue;
    }

    const nombrados = [...new Set(dialogos.map(t => t.personaje).filter(Boolean))];
    const deducido = nombrados.length === 0;
    const hablante = nombrados.length === 1 ? nombrados[0]
      : deducido ? deducirHablante({ tramos, pista: propia, pareja, anterior, generos, conocidos }) : null;

    anterior = hablante;
    if (hablante) {
      for (const tramo of dialogos) {
        if (tramo.personaje) continue;
        tramo.personaje = hablante;
        if (deducido) tramo.deducido = true;
      }
      pareja = [...pareja.filter(n => n !== hablante), hablante].slice(-2);
    }
    ponerGenero(dialogos, propia, generos);
  }
  return resultado;
}

export function generosParaAjustes(parrafos) {
  return Object.fromEntries(generosDelCapitulo(atribuirConversacion(parrafos)));
}
