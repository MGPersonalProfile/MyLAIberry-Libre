const path = require('path');
const { getDataLocation } = require('./db.js');

const ID_DE_OBRA = /^[A-Za-z0-9_-]{1,64}$/;

function dirDeFanfic(id) {
  const limpio = String(id ?? '');
  if (!ID_DE_OBRA.test(limpio)) {
    throw new Error(`Identificador de obra no válido: ${JSON.stringify(limpio).slice(0, 60)}`);
  }
  return path.join(getDataLocation().actual, 'fanfics', limpio);
}

module.exports = { dirDeFanfic, ID_DE_OBRA };
