const { avisar } = require('../ventana.js');
const { crearGestor } = require('../asistente-retos-pendientes.js');
const { crearRemoto } = require('../asistente-reto-remoto.js');
const { crearAlmacen } = require('../asistente-retos-almacen.js');
const { reanudadoresDeLaApp } = require('../asistente-retos-reanudadores.js');

let unico = null;
let controlRemoto = null;

const gestor = () => (unico ||= crearGestor({ avisar: (_canal, datos) => avisar('asistente-reto-pendiente', datos),
  almacen: crearAlmacen(), reanudadores: reanudadoresDeLaApp() }));

const remoto = () => (controlRemoto ||= crearRemoto({ gestor: gestor() }));

function manejadores(g = gestor(), r = g === unico ? remoto() : crearRemoto({ gestor: g })) {

  const autorizacion = (event, token) => ({ local: !event?.desdeElMovil, token });
  return {
    'asistente-reto-remoto-iniciar': async (event, id, token, opciones = {}) => r.iniciar(String(id), autorizacion(event, token), { cliente: typeof opciones?.cliente === 'string' ? opciones.cliente.slice(0, 80) : null }),
    'asistente-reto-remoto-estado': async (event, id, token) => r.estado(String(id), autorizacion(event, token)),
    'asistente-reto-remoto-tocar': async (event, id, token, toque) => r.tocar(String(id), autorizacion(event, token), toque && typeof toque === 'object' ? toque : {}),
    'asistente-reto-remoto-finalizar': async (event, id, token) => r.finalizar(String(id), autorizacion(event, token)),
    'asistente-retos-pendientes': async (event) => g.listar({ conToken: !!event?.desdeElMovil }),
    'asistente-reto-cancelar': async (event, id, token) => g.cancelar(String(id), autorizacion(event, token)),
    'asistente-reto-reanudar': async (event, id, token) => g.reanudar(String(id), autorizacion(event, token)),
    'asistente-reto-reabrir': async (event, id, token) => g.reabrir(String(id), autorizacion(event, token)),
    'asistente-reto-resultado': async (event, id, token) => g.resultado(String(id), autorizacion(event, token))
  };
}

function registrar() {
  const { ipcMain } = require('electron');
  const m = manejadores();
  ipcMain.handle('asistente-retos-pendientes', m['asistente-retos-pendientes']);
  ipcMain.handle('asistente-reto-cancelar', m['asistente-reto-cancelar']);
  ipcMain.handle('asistente-reto-reanudar', m['asistente-reto-reanudar']);
  ipcMain.handle('asistente-reto-reabrir', m['asistente-reto-reabrir']);
  ipcMain.handle('asistente-reto-resultado', m['asistente-reto-resultado']);
  ipcMain.handle('asistente-reto-remoto-iniciar', m['asistente-reto-remoto-iniciar']);
  ipcMain.handle('asistente-reto-remoto-estado', m['asistente-reto-remoto-estado']);
  ipcMain.handle('asistente-reto-remoto-tocar', m['asistente-reto-remoto-tocar']);
  ipcMain.handle('asistente-reto-remoto-finalizar', m['asistente-reto-remoto-finalizar']);
}

module.exports = { registrar, manejadores, gestor, remoto };
