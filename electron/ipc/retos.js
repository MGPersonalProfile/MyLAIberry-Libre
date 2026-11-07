const { avisar } = require('../ventana.js');
const { crearGestor } = require('../asistente-retos-pendientes.js');

let unico = null;

const gestor = () => (unico ||= crearGestor({ avisar: (_canal, datos) => avisar('asistente-reto-pendiente', datos) }));

function manejadores(g = gestor()) {
  const autorizacion = (event, token) => ({ local: !event?.desdeElMovil, token });
  return {
    'asistente-retos-pendientes': async (event) => g.listar({ conToken: !!event?.desdeElMovil }),
    'asistente-reto-cancelar': async (event, id, token) => g.cancelar(String(id), autorizacion(event, token)),
    'asistente-reto-reanudar': async (event, id, token) => g.reanudar(String(id), autorizacion(event, token))
  };
}

function registrar() {
  const { ipcMain } = require('electron');
  const m = manejadores();
  ipcMain.handle('asistente-retos-pendientes', m['asistente-retos-pendientes']);
  ipcMain.handle('asistente-reto-cancelar', m['asistente-reto-cancelar']);
  ipcMain.handle('asistente-reto-reanudar', m['asistente-reto-reanudar']);
}

module.exports = { registrar, manejadores, gestor };
