import { normalizar, huellaDe } from './anclaTexto.js';

const CONTEXTO = 32;
export const MAX_CITA = 4000;

function citaEntre(textos, inicio, fin) {
  const partes = [];
  for (let b = inicio.bloque; b <= fin.bloque; b++) {
    const t = normalizar(textos[b]);
    partes.push(t.slice(b === inicio.bloque ? inicio.caracter : 0, b === fin.bloque ? fin.caracter : t.length));
  }
  return partes.join('\n');
}

export async function crearAnclaRango(textos, inicio, fin, meta = {}) {
  const valido = p => p && Number.isInteger(p.bloque) && p.bloque >= 0 && p.bloque < textos.length
    && Number.isInteger(p.caracter) && p.caracter >= 0 && p.caracter <= normalizar(textos[p.bloque]).length;
  if (!valido(inicio) || !valido(fin)) return null;
  if (inicio.bloque > fin.bloque || (inicio.bloque === fin.bloque && inicio.caracter >= fin.caracter)) return null;
  const cita = citaEntre(textos, inicio, fin);
  if (!cita.replace(/\n/g, '').trim() || cita.length > MAX_CITA) return null;
  const antes = normalizar(textos[inicio.bloque]).slice(0, inicio.caracter);
  const despues = normalizar(textos[fin.bloque]).slice(fin.caracter);
  return { v: 2, obra: String(meta.obra || ''), capitulo: meta.capitulo, variante: String(meta.variante || 'original'),
    totalBloques: textos.length, inicio: { bloque: inicio.bloque, caracter: inicio.caracter },
    fin: { bloque: fin.bloque, caracter: fin.caracter }, cita, huella: await huellaDe(cita),
    contexto: { antes: antes.slice(-CONTEXTO), despues: despues.slice(0, CONTEXTO) } };
}

function candidatos(cita, normales) {
  const partes = cita.split('\n');
  const hallados = [];
  const ultimo = partes.length - 1;
  for (let b = 0; b + ultimo < normales.length; b++) {
    const primero = normales[b];

    for (let i = primero.indexOf(partes[0]); i !== -1; i = primero.indexOf(partes[0], i + 1)) {
      if (ultimo === 0) { hallados.push({ inicio: { bloque: b, caracter: i }, fin: { bloque: b, caracter: i + partes[0].length } }); continue; }
      if (i + partes[0].length !== primero.length) continue;
      let sigue = true;
      for (let k = 1; k < ultimo && sigue; k++) sigue = normales[b + k] === partes[k];
      if (sigue && normales[b + ultimo].startsWith(partes[ultimo])) {
        hallados.push({ inicio: { bloque: b, caracter: i }, fin: { bloque: b + ultimo, caracter: partes[ultimo].length } });
      }
    }
  }
  return hallados;
}

function coincidencia(a, b, desdeElFinal) {
  let n = 0;
  while (n < a.length && n < b.length
    && a[desdeElFinal ? a.length - 1 - n : n] === b[desdeElFinal ? b.length - 1 - n : n]) n++;
  return n;
}

export function resolverAnclaRango(ancla, textos, variante, capitulo) {
  const sin = { inicio: null, fin: null, modo: 'sinUbicar' };
  if (!ancla || ancla.v !== 2 || !ancla.inicio || !ancla.fin || !textos.length) return sin;

  if (capitulo != null && ancla.capitulo != null && String(ancla.capitulo) !== String(capitulo)) return sin;
  const normales = textos.map(normalizar);
  const { inicio, fin } = ancla;
  const enRango = inicio.bloque < normales.length && fin.bloque < normales.length
    && inicio.caracter <= normales[inicio.bloque].length && fin.caracter <= normales[fin.bloque].length;
  if (variante === ancla.variante && enRango && citaEntre(textos, inicio, fin) === ancla.cita) {
    return { inicio: { ...inicio }, fin: { ...fin }, modo: 'exacto' };
  }
  const lista = candidatos(ancla.cita, normales);
  if (!lista.length) return sin;
  const antes = ancla.contexto?.antes || '', despues = ancla.contexto?.despues || '';
  const puntuados = lista.map(c => {
    const previo = normales[c.inicio.bloque].slice(0, c.inicio.caracter);
    const posterior = normales[c.fin.bloque].slice(c.fin.caracter);
    const contexto = coincidencia(previo, antes, true) + coincidencia(posterior, despues, false);
    return { ...c, contexto };
  }).sort((a, b) => b.contexto - a.contexto);
  const [mejor, segundo] = puntuados;

  if (segundo && !(mejor.contexto > segundo.contexto)) return sin;
  return { inicio: mejor.inicio, fin: mejor.fin, modo: 'texto' };
}
