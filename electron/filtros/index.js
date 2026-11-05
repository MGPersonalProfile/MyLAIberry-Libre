const { traducirFFN, idsDePersonajes } = require('./sitio-ffn.js');
const { traducirAO3 } = require('./sitio-ao3.js');
const { traducirRoyalRoad, traducirDeTexto } = require('./sitio-otros.js');
const { aplicarEnMemoria } = require('./memoria.js');
const { normalizar, pedidos, CAMPOS } = require('./modelo.js');

const TRADUCTORES = {
  AO3: traducirAO3,
  'FanFiction.net': traducirFFN,
  RoyalRoad: traducirRoyalRoad,
  Wattpad: (f, o) => traducirDeTexto('Wattpad', f, o),
  Webnovel: (f, o) => traducirDeTexto('Webnovel', f, o),
  WeTriedTLs: (f, o) => traducirDeTexto('WeTriedTLs', f, o),
  'Project Gutenberg': (f, o) => traducirDeTexto('Project Gutenberg', f, o)
};
const FUENTES = Object.keys(TRADUCTORES);

function traducir(fuente, filtros, opciones = {}) {
  const t = TRADUCTORES[fuente];
  if (!t) throw new Error(`No sé traducir filtros para ${fuente}`);
  return t(filtros, opciones);
}

function resumen(plan) {
  return {
    enLaWeb: plan.web,
    ...(plan.memoria.length ? { comprobadoPorLaApp: plan.memoria } : {}),
    ...(plan.sinSoporte.length ? { noVerificable: plan.sinSoporte } : {})
  };
}

module.exports = { traducir, resumen, aplicarEnMemoria, idsDePersonajes, normalizar, pedidos, FUENTES, CAMPOS };
