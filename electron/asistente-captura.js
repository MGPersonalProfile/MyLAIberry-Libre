const path = require('path');
const fs = require('fs');

const ANCHO = 800;
const CALIDAD = 75;
const MAXIMO = 40;
const FORMA = /^pagina-\d+\.jpg$/;

async function guardarCaptura(win, { raiz, ahora = Date.now(), maximo = MAXIMO } = {}) {
  const carpeta = path.join(raiz || require('./db.js').getDataLocation().actual, 'capturas');
  const imagen = await win.webContents.capturePage();
  if (!imagen || imagen.isEmpty()) throw new Error('La página no dejó hacer la captura.');
  const jpg = (imagen.getSize().width > ANCHO ? imagen.resize({ width: ANCHO, quality: 'good' }) : imagen).toJPEG(CALIDAD);
  await fs.promises.mkdir(carpeta, { recursive: true });
  const ruta = path.join(carpeta, `pagina-${ahora}.jpg`);
  await fs.promises.writeFile(ruta, jpg);
  await podar(carpeta, maximo);
  return { ruta, uri: `local-file:///${encodeURI(ruta.replace(/\\/g, '/'))}`, bytes: jpg.length };
}

async function podar(carpeta, maximo) {
  const nuestras = (await fs.promises.readdir(carpeta)).filter(n => FORMA.test(n))
    .sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
  for (const nombre of nuestras.slice(maximo)) await fs.promises.unlink(path.join(carpeta, nombre)).catch(() => {});
}

module.exports = { guardarCaptura, ANCHO, MAXIMO };
