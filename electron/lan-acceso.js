const crypto = require('crypto');
const { getSettings, updateSettings } = require('./db.js');

const VALIDO = /^[A-Za-z0-9_-]{4,64}$/;

function nuevoCodigo() {
  return crypto.randomBytes(6).toString('base64url');
}

async function codigoDeLan({ nuevo = false } = {}) {
  const guardado = (await getSettings())?.codigoLan;
  if (!nuevo && guardado && VALIDO.test(guardado)) return guardado;
  const codigo = nuevoCodigo();
  await updateSettings({ codigoLan: codigo });
  return codigo;
}

module.exports = { codigoDeLan };
