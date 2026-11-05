const { fandoms } = require('./fandoms-ffn.json');
const { sinTildes } = require('./modelo.js');

const normal = (s) => sinTildes(s).replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const variantes = (nombre) => {
  const base = normal(nombre);
  const sinParentesis = normal(String(nombre).replace(/\([^)]*\)/g, ' '));
  const sinArticulo = base.replace(/^the /, '');
  return [...new Set([base, sinParentesis, sinArticulo].filter(Boolean))];
};

function resolverFandomFFN(pedido, tabla = fandoms) {
  const buscados = variantes(pedido);
  if (!buscados.length) return null;
  const fila = (f) => ({ nombre: f[0], ruta: f[1], obras: f[2] });
  const exacto = tabla.find(f => variantes(f[0]).some(v => buscados.includes(v)));
  if (exacto) return fila(exacto);
  const empieza = tabla.filter(f => buscados.some(b => b.length >= 4 && normal(f[0]).startsWith(b + ' ')));
  if (empieza.length) return fila(empieza.sort((a, b) => b[2] - a[2])[0]);
  return null;
}

module.exports = { resolverFandomFFN, normal };
