const numero = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const entero = n => Number.isInteger(n) && n >= 0;

function anclaValida(a) {
  if (a == null) return null;
  if (!entero(a.indice) || !entero(a.total) || a.total < 1 || a.indice >= a.total
    || !numero(a.fraccion) || a.fraccion > 1) return undefined;
  return { indice: a.indice, total: a.total, fraccion: a.fraccion };
}

function posicionValida(p) {
  if (numero(p)) return p;
  if (!p || typeof p !== 'object' || !numero(p.px)) return null;
  const ancla = anclaValida(p.ancla);
  if (ancla === undefined) return null;
  if (p.v !== 2) return { px: p.px, ancla };
  if (typeof p.obra !== 'string' || !p.obra || p.obra.length > 120
    || !entero(p.capitulo) || p.capitulo > 100000
    || !/^(original|[a-z]{2,8})$/.test(p.variante)
    || !entero(p.bloque) || !entero(p.totalBloques) || p.totalBloques < 1
    || p.bloque >= p.totalBloques || !entero(p.caracter) || p.caracter > 1000000
    || !/^sha256:[a-f0-9]{64}$/.test(p.huella)
    || !p.contexto || typeof p.contexto.antes !== 'string' || typeof p.contexto.despues !== 'string'
    || p.contexto.antes.length > 32 || p.contexto.despues.length > 32
    || !numero(p.fraccion) || p.fraccion > 1) return null;
  const resultado = { px: p.px, ancla, v: 2, obra: p.obra, capitulo: p.capitulo,
    variante: p.variante, bloque: p.bloque, totalBloques: p.totalBloques,
    caracter: p.caracter, huella: p.huella,
    contexto: { antes: p.contexto.antes, despues: p.contexto.despues }, fraccion: p.fraccion };
  if (entero(p.revision)) resultado.revision = p.revision;
  if (typeof p.recibidaEn === 'string' && !Number.isNaN(Date.parse(p.recibidaEn))) resultado.recibidaEn = p.recibidaEn;
  return resultado;
}

module.exports = { posicionValida, anclaValida };
