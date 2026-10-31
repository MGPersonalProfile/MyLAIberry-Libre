const { palabrasDe } = require('./buscar-en-todos.js');

const casan = (p, t) => (t.startsWith(p) && (p.length >= 5 || t.length - p.length <= 2)) ||
  (t.length >= 4 && p.startsWith(t) && p.length - t.length <= 2);

function pertinencia(obra, consulta) {
  const pedidas = [...palabrasDe(consulta)];
  if (!pedidas.length) return 1;
  const tiene = [...palabrasDe([obra.title, obra.synopsis, obra.author, ...(obra.tags || []).map(t => t?.name || t)].join(' '))];
  return pedidas.filter(p => tiene.some(t => casan(p, t))).length / pedidas.length;
}

module.exports = { pertinencia };
