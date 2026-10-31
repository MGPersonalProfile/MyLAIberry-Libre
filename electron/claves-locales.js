const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const NOMBRE_VALIDO = /^[A-Z][A-Z0-9_]{1,63}$/;

function rutaDeClaves() {
  return path.join(process.env.MYLAIBERRY_CLAVES || path.join(os.homedir(), '.mylaiberry'), 'claves.json');
}

async function clave(nombre) {
  if (!NOMBRE_VALIDO.test(String(nombre))) throw new Error('Nombre de clave no válido.');
  try {
    const todas = JSON.parse(await fs.readFile(rutaDeClaves(), 'utf8'));
    const v = todas?.[nombre];
    if (typeof v === 'string' && v.trim()) return v.trim();
  } catch (e) {

    if (e.code !== 'ENOENT') throw new Error('No se pudo leer el fichero de claves (¿JSON mal escrito?).');
  }
  const sellada = (await clavesSelladas())[nombre];
  if (typeof sellada === 'string' && sellada.trim()) return sellada.trim();
  return String(process.env[nombre] || '').trim();
}

const NOMBRE_SELLO = 'mylaiberry-claves';
function rutaSellada() { return path.join(path.dirname(rutaDeClaves()), 'claves.sellado'); }
async function clavesSelladas() {
  let sello;
  try { sello = (await fs.readFile(rutaSellada(), 'utf8')).trim(); } catch { return {}; }
  try { return JSON.parse(require('./credenciales-sistema.js').abrir(sello, NOMBRE_SELLO)) || {}; } catch { return {}; }
}

async function clavesPuestas() {
  const selladas = Object.keys(await clavesSelladas());
  let texto;
  try {
    texto = await fs.readFile(rutaDeClaves(), 'utf8');
  } catch {
    return { nombres: selladas, roto: false };
  }
  try {
    const todas = JSON.parse(texto);
    const enClaro = Object.keys(todas).filter(k => typeof todas[k] === 'string' && todas[k].trim());
    return { nombres: [...new Set([...enClaro, ...selladas])], roto: false };
  } catch {
    return { nombres: selladas, roto: true };
  }
}

const PROGRAMA_FUSIONAR = `
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const creds = (args, input) => execFileSync('systemd-creds', ['--user', ...args], { input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
const hayAlmacen = () => { try { return creds(['decrypt', '--name=mylaiberry-prueba', '-', '-'], creds(['encrypt', '--name=mylaiberry-prueba', '-', '-'], 'ok')).toString() === 'ok'; } catch { return false; } };
const guardar = (f, texto) => { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.antes-' + new Date().toISOString().slice(0, 10)); fs.writeFileSync(f + '.nuevo', texto, { mode: 0o600 }); fs.renameSync(f + '.nuevo', f); fs.chmodSync(f, 0o600); };
let entrada = ''; process.stdin.on('data', d => entrada += d).on('end', () => {
  const nuevas = JSON.parse(entrada);
  const dir = process.env.MYLAIBERRY_CLAVES || path.join(os.homedir(), '.mylaiberry'), f = path.join(dir, 'claves.json'), fs2 = path.join(dir, 'claves.sellado');
  fs.mkdirSync(dir, { recursive: true });
  let enClaro = {};
  if (fs.existsSync(f)) { try { enClaro = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { console.log('ROTO: el fichero de claves de allí está mal escrito; no se toca'); process.exit(1); } }
  if (hayAlmacen()) {
    let selladas = {};
    if (fs.existsSync(fs2)) selladas = JSON.parse(creds(['decrypt', '--name=mylaiberry-claves', '-', '-'], fs.readFileSync(fs2, 'utf8').trim()).toString());
    Object.assign(selladas, nuevas);
    guardar(fs2, creds(['encrypt', '--name=mylaiberry-claves', '-', '-'], JSON.stringify(selladas)).toString());
    const quitadas = Object.keys(nuevas).filter(k => k in enClaro);
    if (quitadas.length) { for (const k of quitadas) delete enClaro[k]; guardar(f, JSON.stringify(enClaro, null, 2)); }
    console.log('Allí, selladas con el TPM: ' + Object.keys(selladas).join(', ') + (quitadas.length ? ' (quitadas del fichero en claro: ' + quitadas.join(', ') + ')' : ''));
  } else {
    Object.assign(enClaro, nuevas);
    guardar(f, JSON.stringify(enClaro, null, 2));
    console.log('Allí NO hay almacén de credenciales: en claro, permisos 600: ' + Object.keys(enClaro).join(', '));
  }
});`;

module.exports = { clave, clavesPuestas, rutaDeClaves, PROGRAMA_FUSIONAR };
