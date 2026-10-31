const fs = require('fs');
const path = require('path');

const SOLO_EN_EL_PC = new Set([
  'abrir-importador-web',

  'importar-libro', 'choose-data-location', 'open-data-location', 'exportar-epub', 'guardar-audio-capitulo', 'instalar-voces',

  'restaurar-copia', 'abrir-biblioteca-existente', 'reiniciar-app',
  'abrir-en-navegador', 'iniciar-sesion-sitio', 'iniciar-sesion-web', 'mostrar-fichero', 'marcador-navegador',

  'lan-apagar', 'lan-nuevo-codigo', 'instalar-actualizacion'
]);

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

function puenteParaElMovil() {
  const { metodos, avisos } = leerPuente();
  const permitidos = Object.fromEntries(Object.entries(metodos).filter(([, c]) => !SOLO_EN_EL_PC.has(c)));
  return { metodos: permitidos, avisos };
}

module.exports = { leerPuente, puenteParaElMovil, SOLO_EN_EL_PC };
