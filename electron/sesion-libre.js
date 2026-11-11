const { vedado, deCasa, VEDADOS } = require('./asistente-web-libre');

function dominioBase(host) {
  const p = String(host || '').toLowerCase().replace(/^\.+/, '').split('.').filter(Boolean);
  const compuesto = p.length > 2 && p[p.length - 2].length <= 3 && p[p.length - 1].length === 2;
  return p.slice(compuesto ? -3 : -2).join('.');
}

function sitioDe(direccion) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(direccion) ? direccion : `https://${direccion}`); } catch { throw new Error('Esa dirección no es válida.'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Sólo se entra en páginas https.');
  if (deCasa(host)) throw new Error('Las direcciones de la red de casa no son un sitio en el que entrar.');
  return { url: u.toString(), dominio: dominioBase(host) };
}

const esDelDominio = (c, dominio) => {
  const d = String(c.domain || '').replace(/^\./, '').toLowerCase();
  return d === dominio || d.endsWith('.' + dominio);
};

function abrirLoginLibre(direccion, { particion = null } = {}) {
  const { url, dominio } = sitioDe(direccion);
  const { crearVentana } = require('./user-agent.js');
  return new Promise((resolve) => {
    const win = crearVentana({ width: 1000, height: 820, autoHideMenuBar: true, title: `Iniciar sesión — ${dominio}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, ...(particion ? { partition: particion } : {}) } });

    win.webContents.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle(`Iniciar sesión — ${new URL(win.webContents.getURL()).hostname}`); });
    win.webContents.setWindowOpenHandler(({ url: emergente }) => {

      try { if (new URL(emergente).protocol === 'https:') return { action: 'allow' }; } catch {  }
      return { action: 'deny' };
    });
    win.on('closed', async () => resolve({ dominio, cookies: particion ? await cookiesDe(dominio, particion) : null }));
    win.loadURL(url).catch(() => {});
  });
}

async function cookiesDe(dominio, particion) {
  const { session } = require('electron');
  const todas = await session.fromPartition(particion).cookies.get({});
  return todas.filter(c => esDelDominio(c, dominio)).map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path,
    secure: c.secure, httpOnly: c.httpOnly, hostOnly: c.hostOnly, sameSite: c.sameSite, expirationDate: c.expirationDate }));
}

async function importarCookiesLibre(dominio, cookies, { sesion } = {}) {
  const base = dominioBase(dominio);

  if (!base || vedado(base) || deCasa(base) || VEDADOS.some(d => dominioBase(d) === base)) throw new Error(`Las cookies de ${base || 'ese sitio'} no se guardan en el servidor.`);
  if (!Array.isArray(cookies)) return { dominio: base, puestas: 0 };
  const destino = sesion || require('electron').session.defaultSession;
  const MES = 30 * 24 * 3600;
  let puestas = 0;
  for (const c of cookies.slice(0, 300)) {
    if (!c || typeof c.name !== 'string' || typeof c.value !== 'string' || !esDelDominio(c, base)) continue;
    const host = String(c.domain).replace(/^\./, '');
    try {
      await destino.cookies.set({ url: `http${c.secure ? 's' : ''}://${host}${c.path || '/'}`, name: c.name, value: c.value,
        ...(c.hostOnly ? {} : { domain: c.domain }), path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly,
        ...(c.sameSite && c.sameSite !== 'unspecified' ? { sameSite: c.sameSite } : {}),
        expirationDate: Number(c.expirationDate) || Math.floor(Date.now() / 1000) + MES });
      puestas++;
    } catch {  }
  }
  await destino.cookies.flushStore?.().catch(() => {});
  return { dominio: base, puestas };
}

module.exports = { dominioBase, sitioDe, abrirLoginLibre, cookiesDe, importarCookiesLibre };
