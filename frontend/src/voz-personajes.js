import { trocearDialogos } from './voz-dialogos.js';
import {
  VERBOS_DE_HABLA, TRATAMIENTOS, generoDelInciso, generosPorTratamiento, incisoDeUnTercero,
  generoEnPrimeraPersona
} from './voz-genero.js';

const PRONOMBRES = new Set([
  'él', 'ella', 'ellos', 'ellas', 'yo',
  'he', 'she', 'they', 'i'
]);
const NOMBRE = String.raw`\p{Lu}[\p{L}\p{M}'’-]*`;
const NOMBRE_COMPUESTO = String.raw`${NOMBRE}(?:\s+${NOMBRE}){0,2}`;
const HABLA = `(?:${VERBOS_DE_HABLA.join('|')})`;
const TRATAMIENTO = `(?:${[...TRATAMIENTOS.keys()].join('|')})`;
const VERBO_NOMBRE = new RegExp(String.raw`\b${HABLA}\s+(${NOMBRE_COMPUESTO})`, 'u');
const NOMBRE_VERBO = new RegExp(String.raw`(${NOMBRE_COMPUESTO})\s+${HABLA}\b`, 'u');

const VERBO_TRATAMIENTO = new RegExp(String.raw`\b${HABLA}\s+(?:la|el|the)?\s*(${TRATAMIENTO}\.?\s+${NOMBRE_COMPUESTO})`, 'iu');

const TRATAMIENTO_DELANTE = new RegExp(String.raw`(${TRATAMIENTO}\.?)\s*$`, 'iu');

function nombreValido(nombre) {
  const limpio = nombre?.trim();
  if (!limpio) return null;
  const palabras = limpio.split(/\s+/u);
  if (palabras.some(palabra => PRONOMBRES.has(palabra.toLowerCase()))) return null;
  return limpio;
}

function hablanteDelInciso(texto) {
  const tratado = texto.match(VERBO_TRATAMIENTO)?.[1];
  if (tratado) return tratado.replace(/\s+/gu, ' ');
  const despues = texto.match(VERBO_NOMBRE)?.[1];
  if (despues) return nombreValido(despues);
  const antes = texto.match(NOMBRE_VERBO);
  const nombre = nombreValido(antes?.[1]);
  if (!nombre) return null;
  const tratamiento = texto.slice(0, antes.index).match(TRATAMIENTO_DELANTE)?.[1];
  return tratamiento ? `${tratamiento} ${nombre}` : nombre;
}

export function quienHabla(tramos) {
  const resultado = tramos.map(tramo => ({ ...tramo }));
  for (let i = 0; i < resultado.length; i++) {
    if (resultado[i].tipo === 'dialogo') {
      const primera = generoEnPrimeraPersona(resultado[i].texto);
      if (primera) resultado[i].primera = primera;
      continue;
    }
    const personaje = hablanteDelInciso(resultado[i].texto);
    const genero = generoDelInciso(resultado[i].texto) ||
      (personaje && generosPorTratamiento(personaje)[0]?.[1]) || null;
    const tercero = !personaje && incisoDeUnTercero(resultado[i].texto);
    if (!personaje && !genero) continue;
    for (const vecino of [resultado[i - 1], resultado[i + 1]]) {
      if (vecino?.tipo !== 'dialogo') continue;
      if (personaje) vecino.personaje = personaje;
      if (genero) vecino.genero = genero;
      if (tercero) vecino.tercero = true;
    }
  }
  return resultado;
}

export function personajesEnTextos(textos) {
  const vistos = new Set();
  for (const texto of textos) {
    for (const tramo of quienHabla(trocearDialogos(texto))) {
      if (tramo.personaje) vistos.add(tramo.personaje);
    }
  }
  return [...vistos];
}
