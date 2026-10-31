const { app } = require('electron');

const EN_BANDEJA = '--en-bandeja';

const movilSiempre = (ajustes) => ajustes?.movilSiempre === true;
const abrirConWindows = (ajustes) => ajustes?.abrirConWindows === true;

const arrancaEnBandeja = () => process.argv.includes(EN_BANDEJA);

function aplicarInicioConWindows(activo) {
  if (!app.isPackaged) return false;
  app.setLoginItemSettings({ openAtLogin: !!activo, args: [EN_BANDEJA], name: 'MyLAIberry-libre' });
  return true;
}

const ESPERAS_MS = [30e3, 60e3, 120e3, 300e3];

async function tocaReintentar(d) {
  if (d.yaEncendido()) return false;
  if (!movilSiempre(await d.leerAjustes().catch(() => null))) return false;
  return (await d.estadoTailscale()).instalado;
}

async function encenderMovil(d) {
  for (let intento = 0; ; intento++) {
    try {
      const r = await d.encender();
      console.log(`[Móvil] Encendido: ${r.urls?.[0] || 'sin dirección'}${intento ? ` (intento ${intento + 1})` : ''}`);
      return true;
    } catch (e) {
      const espera = ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)];
      console.warn(`[Móvil] No se pudo encender: ${e.message} Lo intento otra vez en ${espera / 1000} s.`);
      await d.esperar(espera);
      if (!(await tocaReintentar(d))) return false;
    }
  }
}

const dependenciasReales = (leerAjustes) => ({
  encender: () => require('./ipc/fuera.js').encenderLan(),
  yaEncendido: () => require('./servidor-lan.js').estado().encendido,
  estadoTailscale: () => require('./lan/tailscale.js').estadoTailscale(),
  leerAjustes,
  esperar: (ms) => new Promise((r) => setTimeout(r, ms))
});

async function alArrancar(ajustes, leerAjustes = async () => ajustes) {
  aplicarInicioConWindows(abrirConWindows(ajustes));
  if (!movilSiempre(ajustes)) return;

  if (process.env.MYLAIBERRY_DATOS) return;
  await encenderMovil(dependenciasReales(leerAjustes));
}

module.exports = { movilSiempre, abrirConWindows, arrancaEnBandeja, aplicarInicioConWindows, alArrancar, encenderMovil, ESPERAS_MS, EN_BANDEJA };
