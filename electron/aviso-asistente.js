const LARGO_MS = 60 * 1000;

function viaDelAviso({ ms, desdeElMovil = false, ventanaConFoco = false, escritorio = false, ntfy = false }) {
  if (!(ms >= LARGO_MS)) return null;
  if (desdeElMovil) return ntfy ? 'ntfy' : null;
  if (ventanaConFoco) return null;
  return escritorio ? 'escritorio' : ntfy ? 'ntfy' : null;
}

function textoDelAviso({ texto = '', error = false }) {
  const linea = String(texto || '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return {
    title: error ? 'El asistente no pudo terminar' : 'El asistente ha terminado',
    body: linea ? (linea.length > 140 ? linea.slice(0, 139) + '…' : linea) : 'Tu encargo está listo en el asistente.'
  };
}

async function avisarSiTardo({ inicio, desdeElMovil, texto, error = false }) {
  try {
    const { Notification } = require('electron');
    const ntfy = require('./aviso-ntfy.js');
    const v = require('./ventana.js').ventana();
    let escritorio = false;
    try { escritorio = Notification.isSupported(); } catch {  }
    const via = viaDelAviso({ ms: Date.now() - inicio, desdeElMovil, ventanaConFoco: !!v?.isFocused(), escritorio, ntfy: !!ntfy.canal() });
    if (!via) return null;
    const aviso = textoDelAviso({ texto, error });
    if (via === 'ntfy') await ntfy.avisarPorNtfy(aviso);
    else {
      const n = new Notification(aviso);
      n.on('click', () => require('./ventana.js').traerAlFrente());
      n.show();
    }
    return via;
  } catch (e) {
    console.warn('[Asistente] no se pudo avisar del final:', e.message);
    return null;
  }
}

module.exports = { viaDelAviso, textoDelAviso, avisarSiTardo, LARGO_MS };
