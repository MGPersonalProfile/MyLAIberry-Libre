const { execFile } = require('child_process');
const fs = require('fs');

const CANDIDATOS = [

  'C:/Program Files/Tailscale/tailscale.exe',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
  '/usr/bin/tailscale',
  '/usr/local/bin/tailscale'
];

function programa() {
  return CANDIDATOS.find(c => { try { return fs.existsSync(c); } catch { return false; } }) || 'tailscale';
}

function ejecutarDeVerdad(args) {
  return new Promise((ok, mal) => {
    execFile(programa(), args, { timeout: 8000, windowsHide: true }, (e, salida, errores) => {
      if (e) mal(new Error(String(errores || e.message).trim().split('\n')[0]));
      else ok(String(salida));
    });
  });
}

async function estadoTailscale({ ejecutar = ejecutarDeVerdad } = {}) {
  let crudo;
  try {
    crudo = await ejecutar(['status', '--json']);
  } catch (e) {
    const noEsta = /ENOENT|not found|no se reconoce|not recognized/i.test(e.message);
    return { instalado: !noEsta, conectado: false, nombre: null, error: noEsta ? null : e.message };
  }
  try {
    const s = JSON.parse(crudo);
    const nombre = String(s?.Self?.DNSName || '').replace(/\.$/, '').toLowerCase();
    const conectado = s?.BackendState === 'Running' && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(nombre);
    return { instalado: true, conectado, nombre: conectado ? nombre : null };
  } catch {
    return { instalado: true, conectado: false, nombre: null, error: 'Tailscale contestó algo que no se entiende.' };
  }
}

async function publicar(puerto, { ejecutar = ejecutarDeVerdad } = {}) {
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('Puerto no válido.');
  await ejecutar(['serve', '--bg', '--https=443', `http://127.0.0.1:${puerto}`]);
}

async function retirar({ ejecutar = ejecutarDeVerdad } = {}) {
  try {
    await ejecutar(['serve', '--https=443', 'off']);
  } catch (e) {
    if (!/not found|no serve config|nothing to|does not exist|no existe/i.test(e.message)) throw e;
  }
}

module.exports = { estadoTailscale, publicar, retirar, CANDIDATOS };
