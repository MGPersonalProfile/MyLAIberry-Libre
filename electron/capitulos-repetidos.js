const { createHash } = require('crypto');
const { textoPlano } = require('./capitulo-valido.js');

const LARGO = 8;

function palabrasDe(html) {
  return textoPlano(html).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function fragmentos(palabras) {
  const lista = [];
  for (let i = 0; i + LARGO <= palabras.length; i++) {
    lista.push(createHash('md5').update(palabras.slice(i, i + LARGO).join(' ')).digest('hex').slice(0, 12));
  }
  return lista;
}

function repeticionInterna(lista) {
  if (lista.length < 50) return 0;
  const vistos = new Set();
  let repetidos = 0;
  for (const f of lista) { if (vistos.has(f)) repetidos++; else vistos.add(f); }
  return repetidos / lista.length;
}

function compartidosPorPar(conjuntos) {
  const dondeSale = new Map();
  conjuntos.forEach((c, i) => c.forEach(f => (dondeSale.get(f) || dondeSale.set(f, []).get(f)).push(i)));
  const pares = new Map();
  for (const indices of dondeSale.values()) {
    if (indices.length < 2 || indices.length > 20) continue;
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const k = `${indices[a]}:${indices[b]}`;
        pares.set(k, (pares.get(k) || 0) + 1);
      }
    }
  }
  return pares;
}

function buscarRepetidos(capitulos, { umbral = 0.5, interno = 0.2 } = {}) {
  const leidos = capitulos.filter(c => c.html).map(c => ({ numero: c.numero, lista: fragmentos(palabrasDe(c.html)) }));
  const conjuntos = leidos.map(c => new Set(c.lista));
  const repetidos = [];
  for (const [k, n] of compartidosPorPar(conjuntos)) {
    const [a, b] = k.split(':').map(Number);
    const menor = Math.min(conjuntos[a].size, conjuntos[b].size) || 1;
    if (n / menor >= umbral) {
      repetidos.push({ capitulos: [leidos[a].numero, leidos[b].numero], parteCompartida: Math.round((n / menor) * 100) + '%',
        identicos: conjuntos[a].size === conjuntos[b].size && n === menor });
    }
  }
  const conTramosRepetidos = leidos.map(c => ({ capitulo: c.numero, parte: repeticionInterna(c.lista) }))
    .filter(c => c.parte >= interno).map(c => ({ capitulo: c.capitulo, parteRepetida: Math.round(c.parte * 100) + '%' }));
  return {
    revisados: leidos.map(c => c.numero),
    sinTexto: capitulos.filter(c => !c.html).map(c => c.numero),
    repetidos: repetidos.sort((x, y) => x.capitulos[0] - y.capitulos[0]),
    conTramosRepetidos
  };
}

function repetidosDeLaCarpeta(dir, n) {
  const fs = require('node:fs');
  const path = require('node:path');
  const capitulos = [];
  for (let i = 0; i < n; i++) {
    let html = '';
    try { html = fs.readFileSync(path.join(dir, `chapter_${i}.html`), 'utf-8'); } catch {  }
    capitulos.push({ numero: i + 1, html });
  }
  return buscarRepetidos(capitulos);
}

module.exports = { buscarRepetidos, repetidosDeLaCarpeta };
