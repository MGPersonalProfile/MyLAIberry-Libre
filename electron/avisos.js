const path = require('path');
const { Notification, Tray, Menu, nativeImage } = require('electron');
const ntfy = require('./aviso-ntfy.js');

const AGRUPAR_MS = 90 * 1000;

let bandeja = null;
let acumulados = new Map();
let temporizador = null;
let alPulsar = null;
let enlace = () => null;

function icono(lado = 0) {
  const ruta = path.join(__dirname, '..', 'assets', 'icon.png');
  const img = nativeImage.createFromPath(ruta);
  if (img.isEmpty()) return null;
  return lado ? img.resize({ width: lado, height: lado, quality: 'best' }) : img;
}

function deEscritorio() {
  try {
    return Notification.isSupported();
  } catch {
    return false;
  }
}

function disponible() {
  return deEscritorio() || !!ntfy.canal();
}

function via() {
  return deEscritorio() ? 'escritorio' : ntfy.canal() ? 'ntfy' : null;
}

function textoDelAviso(obras) {
  if (obras.length === 1) {
    const o = obras[0];
    return {
      title: o.titulo,
      body: o.nuevos === 1
        ? 'Hay un capítulo nuevo.'
        : `Hay ${o.nuevos} capítulos nuevos.`
    };
  }

  const total = obras.reduce((s, o) => s + o.nuevos, 0);
  return {
    title: `${obras.length} obras con capítulos nuevos`,

    body: obras.slice(0, 3).map(o => o.titulo).join(' · ')
      + (obras.length > 3 ? ` y ${obras.length - 3} más` : '')
      + ` — ${total} capítulos`
  };
}

function soltarAviso() {
  temporizador = null;
  const obras = [...acumulados.values()];
  acumulados = new Map();
  if (obras.length === 0 || !disponible()) return;

  const { title, body } = textoDelAviso(obras);
  if (!deEscritorio()) {
    ntfy.avisarPorNtfy({ title, body }, { enlace: enlace() });
    return;
  }
  const img = icono();
  const aviso = new Notification({ title, body, ...(img ? { icon: img } : {}) });

  aviso.on('click', () => {
    if (alPulsar) alPulsar(obras.length === 1 ? obras[0].id : null);
  });
  aviso.show();
}

function hayCapitulosNuevos({ id, titulo, nuevos }) {
  if (!nuevos || nuevos < 1) return;

  const previo = acumulados.get(String(id));
  acumulados.set(String(id), {
    id: String(id),
    titulo: titulo || 'Una obra tuya',
    nuevos: (previo?.nuevos || 0) + nuevos
  });

  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(soltarAviso, AGRUPAR_MS);
}

function soltarLoPendiente() {
  if (!temporizador) return;
  clearTimeout(temporizador);
  soltarAviso();
}

function ponerEnBandeja({ alAbrir, alSalir }) {
  if (bandeja) return bandeja;

  const img = icono(16);
  if (!img) console.warn('[Bandeja] No se encuentra assets/icon.png: el icono no se verá.');
  bandeja = new Tray(img || nativeImage.createEmpty());
  bandeja.setToolTip('MyLAIberry — buscando capítulos nuevos');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir MyLAIberry', click: () => alAbrir && alAbrir() },
    { type: 'separator' },
    { label: 'Salir', click: () => alSalir && alSalir() }
  ]));

  bandeja.on('double-click', () => alAbrir && alAbrir());
  return bandeja;
}

function quitarDeBandeja() {
  if (!bandeja) return;
  bandeja.destroy();
  bandeja = null;
}

function alTocarAviso(fn) {
  alPulsar = fn;
}

function enlaceDeLaApp(fn) {
  enlace = () => { try { return fn() || null; } catch { return null; } };
}

module.exports = {
  disponible,
  via,
  enlaceDeLaApp,
  hayCapitulosNuevos,
  soltarLoPendiente,
  ponerEnBandeja,
  quitarDeBandeja,
  alTocarAviso,
  textoDelAviso
};
