const path = require('path');

const TIPOS = { epub: 'EPUB', mp3: 'MP3', zip: 'ZIP', json: 'JSON', pdf: 'PDF', txt: 'texto' };

function opcionesDeGuardado(nombre, carpeta) {
  const ext = path.extname(nombre || '').slice(1).toLowerCase();
  const tipo = TIPOS[ext];
  return {
    title: tipo ? `Guardar ${tipo}` : 'Guardar',
    defaultPath: path.join(carpeta, nombre || 'descarga'),
    filters: tipo ? [{ name: tipo, extensions: [ext] }] : [],
  };
}

function atenderDescargas(sesion, win, { dialog, carpeta }) {
  const alDescargar = (_e, item) => {
    const destino = dialog.showSaveDialogSync(win, opcionesDeGuardado(item.getFilename(), carpeta));
    if (!destino) { item.cancel(); return; }
    item.setSavePath(destino);
  };
  sesion.on('will-download', alDescargar);
  const soltar = () => sesion.removeListener('will-download', alDescargar);
  win.once('closed', soltar);
  return soltar;
}

module.exports = { atenderDescargas, opcionesDeGuardado };
