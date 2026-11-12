const fs = require('fs');
const path = require('path');

const SOLO_EN_EL_PC = new Set([
  'abrir-importador-web',

  'importar-libro', 'choose-data-location', 'open-data-location', 'exportar-epub', 'guardar-audio-capitulo', 'guardar-audio-obra', 'instalar-voces',

  'restaurar-copia', 'listar-recuperables', 'recuperar-obra', 'recuperar-cambios-obra', 'recuperar-trabajos', 'abrir-biblioteca-existente', 'reiniciar-app',
  'abrir-en-navegador', 'iniciar-sesion-sitio', 'iniciar-sesion-web', 'mostrar-fichero', 'marcador-navegador',

  'lan-apagar', 'lan-nuevo-codigo', 'instalar-actualizacion'
]);

const CON_CODIGO_OBLIGATORIO = new Set(['asistente-retos-pendientes', 'asistente-reto-reanudar', 'asistente-reto-cancelar',

  'asistente-reto-reabrir', 'asistente-reto-resultado',

  'asistente-reto-remoto-iniciar', 'asistente-reto-remoto-estado', 'asistente-reto-remoto-tocar', 'asistente-reto-remoto-finalizar',

  'obtener-catalogo-serie', 'importar-obras-serie']);

function leerPuente(fuente = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf-8')) {
  const metodos = {};
  for (const m of fuente.matchAll(/^\s{2}(\w+):\s*\([^)]*\)\s*=>\s*ipcRenderer\.invoke\(\s*'([^']+)'/gm)) {
    metodos[m[1]] = m[2];
  }
  const avisos = {};
  const trozos = fuente.split(/^\s{2}(?=\w+:\s*\()/m);
  for (const t of trozos) {
    const nombre = (t.match(/^(\w+):/) || [])[1];
    const evento = (t.match(/ipcRenderer\.on\(\s*'([^']+)'/) || [])[1];
    if (nombre && evento) avisos[nombre] = { evento, unico: t.includes(`removeAllListeners('${evento}')`) };
  }
  return { metodos, avisos };
}

function equipoQueSirve(env = process.env) {
  return env.MYLAIBERRY_SIN_PANTALLA === '1'
    ? { tipo: 'servidor', nombre: 'servidor', name: 'server' }
    : { tipo: 'pc', nombre: 'PC', name: 'PC' };
}

function puenteParaElMovil(env = process.env) {
  const { metodos, avisos } = leerPuente();
  const permitidos = Object.fromEntries(Object.entries(metodos).filter(([, c]) => !SOLO_EN_EL_PC.has(c)));
  return { metodos: permitidos, avisos, equipo: equipoQueSirve(env) };
}

module.exports = { leerPuente, puenteParaElMovil, equipoQueSirve, SOLO_EN_EL_PC, CON_CODIGO_OBLIGATORIO };
