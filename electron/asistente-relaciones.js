const { PAREJAS, FANDOMS, sinAcentos } = require('./asistente-vetos-parejas');

const limpio = (s) => sinAcentos(s).replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const NO_NOMBRES = new Set(['angst', 'fluff', 'hurt', 'comfort', 'crack', 'romance', 'humor', 'drama', 'canon', 'fix', 'au', 'smut', 'sfw', 'nsfw',
  'slow burn', 'dark', 'light', 'cute', 'sad', 'happy', 'friendship', 'family', 'gen', 'm', 'f', 'male', 'female', 'other', 'multi', 'and', 'or']);
const NOMBRE_PROPIO = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u;
const CASILLA = /^(?:m\/m|f\/m|m\/f|f\/f|gen|multi|other)$/i;

const nombreDe = (t) => (typeof t === 'object' && t ? String(t.name ?? '') : String(t ?? '')).trim();
const categoriaDe = (t) => (typeof t === 'object' && t ? String(t.category ?? '') : '');

function pareceRelacion(nombre) {
  if (CASILLA.test(nombre) || /^(?:no|sin|non)\b/i.test(nombre)) return false;
  const lados = nombre.replace(/\([^)]*\)/g, ' ').split(/\s*(?:\/|\s[x×]\s)\s*/);
  return lados.length >= 2 && lados.every(l => NOMBRE_PROPIO.test(l.trim()) && !NO_NOMBRES.has(limpio(l)) && limpio(l).length > 2);
}

const ladosDe = (nombre) => nombre.replace(/\([^)]*\)/g, ' ').split(/\s*(?:\/|\s[x×]\s)\s*/).map(l => l.trim()).filter(Boolean);
const esRomantica = (nombre) => /\/|\s[x×]\s/.test(nombre) && !/&/.test(nombre.replace(/\([^)]*\)/g, ' '));

function conocidaPara(x, y, fandom) {
  const f = sinAcentos(fandom);
  return PAREJAS.find(p => (!f || FANDOMS[p.id].test(f)) && (
    (p.a.includes(x) && p.b.includes(y)) || (p.b.includes(x) && p.a.includes(y)))) || null;
}

function deUnaEtiqueta(nombre, fandom) {
  const lados = ladosDe(nombre).map(limpio);
  const pares = [];
  for (let i = 0; i < lados.length; i++) for (let j = i + 1; j < lados.length; j++) pares.push([lados[i], lados[j]]);
  return pares.filter(([x, y]) => x && y && x !== y).map(([x, y]) => {
    const conocida = conocidaPara(x, y, fandom);
    return { crudo: nombre, tipo: 'romantica', lados: [x, y], id: conocida ? conocida.id : [x, y].sort().join('/'), conocida };
  });
}

function relacionesDe(etiquetas = [], { fandom = '' } = {}) {
  const lista = (etiquetas || []).map(t => ({ nombre: nombreDe(t), categoria: categoriaDe(t) })).filter(t => t.nombre);
  const contexto = [fandom, ...lista.filter(t => t.categoria === 'fandom').map(t => t.nombre)].join(' ');
  const salida = [];
  const ya = new Set();
  const poner = (r) => { const k = `${r.crudo}|${r.id}`; if (!ya.has(k)) { ya.add(k); salida.push(r); } };
  for (const { nombre, categoria } of lista) {

    const porAlias = PAREJAS.find(p => p.reAlias.test(sinAcentos(nombre)));
    if (porAlias) { poner({ crudo: nombre, tipo: 'romantica', lados: [], id: porAlias.id, conocida: porAlias }); continue; }
    const esRel = categoria === 'relationship' || (!categoria && pareceRelacion(nombre));
    if (!esRel) continue;
    if (!esRomantica(nombre)) { poner({ crudo: nombre, tipo: 'platonica', lados: ladosDe(nombre), id: `&:${limpio(nombre)}`, conocida: null }); continue; }
    deUnaEtiqueta(nombre, contexto).forEach(poner);
  }
  return salida;
}

module.exports = { relacionesDe, pareceRelacion, conocidaPara };
