const { cargarPagina, conRitmo, exigirQueNoEnfrie, limitado } = require('./navegar.js');

const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MyLAIberry/1.0';

async function pedirHTML(url, msTope = 45000) {
  return conRitmo(url, async () => {
    const r = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(msTope)
    });
    if (r.status === 404) throw Object.assign(new Error('La obra ya no existe en AO3 (404). ¿La han borrado?'), { noExiste: true });

    if (r.status === 429 || r.status === 418) {
      throw limitado(url, r.status, await r.text().catch(() => ''));
    }
    if (r.status === 525 || r.status === 503) throw new Error(`AO3 no responde ahora mismo (${r.status}). Inténtalo en un momento.`);
    if (!r.ok) throw new Error(`AO3 respondió ${r.status}`);
    return await r.text();
  });
}

async function pedirHTMLConNavegador(url, msEspera = 6000) {

  exigirQueNoEnfrie(url);
  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow({
    width: 1280, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  try {
    await cargarPagina(win, url);

    await new Promise(r => setTimeout(r, msEspera));
    return await win.webContents.executeJavaScript('document.documentElement.outerHTML');
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { pedirHTML, pedirHTMLConNavegador };
