const { leer, writeDB } = require('./nucleo.js');
const { registrarSesion, diaCivil } = require('../lector/sesiones.js');
const { estadisticas, exportarJSON, exportarCSV } = require('../lector/estadisticas.js');

const almacen = { leer, guardar: writeDB };

const registrarSesionLectura = (sesion, capitulo, ahora) => registrarSesion(almacen, sesion, capitulo, ahora);

function hoyEn(zona, ahora = Date.now()) {
  try { return diaCivil(ahora, typeof zona === 'string' ? zona : undefined); } catch { return diaCivil(ahora); }
}

async function estadisticasLectura(zona, ahora) {
  return estadisticas((await leer()).memoriaLectura, hoyEn(zona, ahora));
}

async function exportarLectura(formato) {
  const mem = (await leer()).memoriaLectura;
  return formato === 'csv' ? exportarCSV(mem) : JSON.stringify(exportarJSON(mem), null, 2);
}

module.exports = { registrarSesionLectura, estadisticasLectura, exportarLectura };
