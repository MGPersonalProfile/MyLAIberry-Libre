const { execFileSync } = require('node:child_process');

let disponibleCache = null;
const descifrados = new Map();

function ejecutar(args, entrada) {
  return execFileSync('systemd-creds', ['--user', ...args], { input: entrada, timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
}

function disponible() {
  if (disponibleCache !== null) return disponibleCache;
  disponibleCache = false;
  if (process.platform !== 'linux' || process.env.MYLAIBERRY_SIN_ALMACEN === '1') return false;
  try {
    const sello = ejecutar(['encrypt', '--name=mylaiberry-prueba', '-', '-'], 'ok');
    disponibleCache = ejecutar(['decrypt', '--name=mylaiberry-prueba', '-', '-'], sello).toString() === 'ok';
  } catch { disponibleCache = false; }
  return disponibleCache;
}

function sellar(texto, nombre) {
  return ejecutar(['encrypt', `--name=${nombre}`, '-', '-'], String(texto)).toString().replace(/\s+/g, '');
}

function abrir(sello, nombre) {
  const clave = nombre + '\0' + sello;
  if (descifrados.has(clave)) return descifrados.get(clave);
  const texto = ejecutar(['decrypt', `--name=${nombre}`, '-', '-'], String(sello)).toString();
  descifrados.set(clave, texto);
  return texto;
}

module.exports = { disponible, sellar, abrir };
