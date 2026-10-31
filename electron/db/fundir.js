const path = require('path');
const fs = require('fs').promises;
const nucleo = require('./nucleo.js');
const { leer, carpetaDeObra } = nucleo;
const { escribirEntero } = require('../escritura-entera.js');

async function fundirObras(quedaId, sobraId, cambios = {}) {
  const datos = await leer();
  const queda = datos.fanfics.find(f => String(f.id) === String(quedaId));
  const iSobra = datos.fanfics.findIndex(f => String(f.id) === String(sobraId));
  if (!queda || iSobra === -1) throw new Error('Una de las dos obras ya no está en la biblioteca.');
  if (String(quedaId) === String(sobraId)) throw new Error('Es la misma obra: no hay nada que fundir.');
  const sobra = datos.fanfics[iSobra];

  const origen = carpetaDeObra(sobra.id);

  const fundidas = path.join(path.dirname(path.dirname(origen)), 'fundidas');
  await fs.mkdir(fundidas, { recursive: true });
  let destino = path.join(fundidas, path.basename(origen));

  if (await fs.stat(destino).then(() => true, () => false)) destino += '-' + Date.now();

  if (await fs.stat(origen).then(() => true, () => false)) await require('./copiar-biblioteca.js').renombrarConReintentos(origen, destino);
  else await fs.mkdir(destino, { recursive: true });
  const fundidaEn = Date.now();
  await escribirEntero(path.join(destino, 'obra.json'), JSON.stringify({ ...sobra, fundidaEn, fundidaCon: String(queda.id) }, null, 2));

  Object.assign(queda, cambios);
  datos.fanfics.splice(iSobra, 1);
  try {
    await nucleo.writeDB();
  } catch (e) {

    await require('./copiar-biblioteca.js').renombrarConReintentos(destino, origen).catch(() => {});
    throw e;
  }
  return { status: 'ok', queda: String(queda.id), fundida: String(sobra.id), apartadaEn: destino };
}

module.exports = { fundirObras };
