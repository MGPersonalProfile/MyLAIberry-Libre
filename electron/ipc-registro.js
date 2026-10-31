const manejadores = new Map();

function instalar(ipcMain) {
  if (ipcMain.__conRegistro) return;
  const original = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (canal, fn) => {
    manejadores.set(canal, fn);
    return original(canal, fn);
  };
  ipcMain.__conRegistro = true;
}

async function llamar(canal, args = []) {
  const fn = manejadores.get(canal);
  if (!fn) throw new Error(`No hay manejador para «${canal}».`);
  return fn({ desdeElMovil: true }, ...args);
}

module.exports = { instalar, llamar };
