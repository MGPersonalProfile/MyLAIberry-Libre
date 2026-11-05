const { claveDeObra } = require('../misma-obra');

const TOPE = 600;
const vistas = new Map();

function recordar(fuente, obras, filtros) {
  for (const obra of obras || []) {
    const clave = claveDeObra(obra.url);
    if (!clave) continue;
    vistas.delete(clave);
    vistas.set(clave, { obra, fuente, filtros });
    if (vistas.size > TOPE) vistas.delete(vistas.keys().next().value);
  }
}

const obtener = (url) => vistas.get(claveDeObra(url)) || null;

module.exports = { recordar, obtener };
