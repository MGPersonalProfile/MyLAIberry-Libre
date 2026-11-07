const nucleo = require('./db/nucleo.js');
const obras = require('./db/obras.js');
const ajustes = require('./db/ajustes.js');
const anotaciones = require('./db/anotaciones.js');
const generos = require('./db/generos.js');
const seguimiento = require('./db/seguimiento.js');
const trabajos = require('./db/trabajos.js');

module.exports = {

  initDB: nucleo.initDB,
  getDataRoot: nucleo.getDataRoot,
  raizActual: nucleo.raizActual,
  getDataLocation: nucleo.getDataLocation,
  setDataLocation: nucleo.setDataLocation,
  apuntarABibliotecaExistente: nucleo.apuntarABibliotecaExistente,
  alHaberConflicto: nucleo.alHaberConflicto,

  ...obras,
  ...ajustes,
  ...anotaciones,
  ...generos,
  ...seguimiento,
  ...require('./db/subrayados.js'),
  ...require('./db/descubrimientos.js'),
  ...require('./db/fundir.js'),
  ...require('./db/memoria-lectura.js'),
  ...require('./db/recordatorios.js'),
  ...trabajos,

  listarCopias: () => require('./db/copias.js').listarCopias(nucleo.raizActual()),
  restaurarCopia: async (archivo) => {
    const r = await require('./db/copias.js').restaurarCopia(nucleo.raizActual(), archivo);

    if (await nucleo.releerSiAbierta()) await require('./db/migraciones.js').aplicar({ db: nucleo.instancia(), writeDB: nucleo.writeDB });
    return r;
  }
};

const fueraDelCerrojo = new Set([
  'getDataRoot', 'raizActual', 'getDataLocation', 'rutaDeFondo', 'alHaberConflicto', 'saveCoverLocally',

  'listarCopias',

  'apuntarABibliotecaExistente'
]);

let enCurso = Promise.resolve();

const { conDisco } = require('./barrera-disco.js');
module.exports.saveCoverLocally = (...args) => conDisco(() => obras.saveCoverLocally(...args));

for (const [nombre, operacion] of Object.entries(module.exports)) {
  if (fueraDelCerrojo.has(nombre)) continue;

  module.exports[nombre] = (...args) => {
    const resultado = enCurso.then(async () => {
      const valor = await operacion(...args);

      return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
    });

    enCurso = resultado.catch(() => {});
    return resultado;
  };
}
