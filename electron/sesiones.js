const { session, shell } = require('electron');

const SITIOS = {
  ao3: {
    nombre: 'Archive of Our Own',
    dominios: ['archiveofourown.org'],
    login: 'https://archiveofourown.org/users/login',
    inicio: 'https://archiveofourown.org/',

    gana: 'Tus marcadores, tu "marked for later", tus suscripciones y las obras restringidas a usuarios registrados.'
  },
  ffn: {
    nombre: 'FanFiction.net',
    dominios: ['fanfiction.net', 'www.fanfiction.net'],
    login: 'https://www.fanfiction.net/login.php',
    inicio: 'https://www.fanfiction.net/',
    gana: 'Tus favoritos y tus historias seguidas.'
  },
  royalroad: {
    nombre: 'RoyalRoad',
    dominios: ['royalroad.com', 'www.royalroad.com'],
    login: 'https://www.royalroad.com/account/login',
    inicio: 'https://www.royalroad.com/home',
    gana: 'Tu estantería y las obras que sigues.'
  },
  wetriedtls: {
    nombre: 'We Tried TLs',
    dominios: ['wetriedtls.com'],
    login: 'https://wetriedtls.com/login',
    inicio: 'https://wetriedtls.com/',
    gana: 'Tus marcadores del sitio.'
  },

  reddit: {
    nombre: 'Reddit',
    dominios: ['reddit.com', 'www.reddit.com'],
    login: 'https://www.reddit.com/login/',
    inicio: 'https://www.reddit.com/',
    cookie: 'reddit_session',
    gana: 'Que el asistente lea las recomendaciones de Reddit con sus votos y sus comentarios (sin sesión, Reddit lo bloquea).'
  }
};

const SONDEO = `
new Promise((resolve) => {
  setTimeout(() => {
    const enlaces = [...document.querySelectorAll('a[href]')];
    const PALABRAS = ['logout', 'log-out', 'log_out', 'logoff', 'log-off', 'signout', 'sign-out', 'sign_out'];
    const esSalir = (h) => {
      let ruta = '';
      try { ruta = new URL(String(h || ''), location.href).pathname.toLowerCase(); } catch (e) { return false; }
      if (ruta.includes('help') || ruta.includes('faq')) return false;
      return PALABRAS.some(p => ruta.includes(p));
    };
    const TEXTOS = ['log out', 'logout', 'sign out', 'log off', 'cerrar sesión', 'cerrar sesion'];
    const diceSalir = (el) => TEXTOS.includes(String(el.textContent || el.value || '').trim().toLowerCase());
    const salir = enlaces.some(a => esSalir(a.getAttribute('href')))
      || [...document.querySelectorAll('form[action]')].some(f => esSalir(f.getAttribute('action')))
      || [...document.querySelectorAll('[formaction]')].some(e => esSalir(e.getAttribute('formaction')))
      || [...document.querySelectorAll('a, button, input[type=submit]')].some(diceSalir);

    let usuario = '';
    if (salir) {
      const saludo = document.querySelector('#greeting');
      if (saludo) {
        const propio = saludo.querySelector('a[href*="/users/"]');
        if (propio) usuario = (propio.textContent || '').trim();
      }
      if (!usuario) {
        const RUIDO = ['log', 'forgot', 'member', 'sign', 'password', 'help', 'about'];
        for (const a of enlaces) {
          const h = String(a.getAttribute('href') || '');
          if (!h.includes('/user/') && !h.includes('/users/') && !h.includes('/profile/')) continue;
          const t = (a.textContent || '').trim();
          const bajo = t.toLowerCase();
          if (!t || t.length > 40) continue;
          if (RUIDO.some(r => bajo.includes(r))) continue;
          usuario = t;
          break;
        }
      }
    }

    resolve({ dentro: salir, usuario: usuario.slice(0, 40) });
  }, 2500);
});
`;

const memoria = new Map();

const enVuelo = new Map();

function sitio(id) {
  return Object.prototype.hasOwnProperty.call(SITIOS, String(id)) ? SITIOS[String(id)] : null;
}

function descripcion(id) {
  const s = sitio(id);
  if (!s) return null;
  const guardado = memoria.get(id);
  return {
    id,
    nombre: s.nombre,
    dominio: s.dominios[0],
    gana: s.gana,
    dentro: guardado ? guardado.dentro : null,
    usuario: guardado ? guardado.usuario : '',
    comprobadoEn: guardado ? guardado.cuando : null
  };
}

function listar() {
  return Object.keys(SITIOS).map(descripcion);
}

function comprobar(id) {
  if (!sitio(id)) return Promise.resolve(null);
  if (enVuelo.has(id)) return enVuelo.get(id);

  const tarea = mirarDeVerdad(id).finally(() => enVuelo.delete(id));
  enVuelo.set(id, tarea);
  return tarea;
}

async function mirarDeVerdad(id) {
  const s = sitio(id);
  if (s.cookie) {

    const hay = (await session.defaultSession.cookies.get({ domain: s.dominios[0], name: s.cookie })).length > 0;
    memoria.set(id, { dentro: hay, usuario: '', cuando: Date.now() });
    return descripcion(id);
  }

  const win = crearVentana({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  try {
    await win.loadURL(s.inicio);
    const r = await win.webContents.executeJavaScript(SONDEO);
    memoria.set(id, { dentro: !!r.dentro, usuario: r.usuario || '', cuando: Date.now() });
  } catch {

    if (!memoria.has(id)) memoria.set(id, { dentro: null, usuario: '', cuando: Date.now() });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
  return descripcion(id);
}

async function comprobarTodos() {
  for (const id of Object.keys(SITIOS)) await comprobar(id);
  return listar();
}

const { sinMarcaDeElectron, crearVentana } = require('./user-agent.js');

const IDENTIDAD = ['accounts.google.com', 'login.microsoftonline.com', 'login.live.com', 'www.facebook.com', 'facebook.com',
  'api.twitter.com', 'twitter.com', 'x.com', 'appleid.apple.com', 'discord.com', 'www.patreon.com', 'patreon.com'];

function esDelLogin(url, s) {
  try {
    const h = new URL(url).hostname;
    return IDENTIDAD.includes(h) || s.dominios.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function repartirEmergentes(win, s) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (esDelLogin(url, s)) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } };
    }
    try { if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url); } catch {  }
    return { action: 'deny' };
  });

  win.webContents.on('did-create-window', (hija) => {

    repartirEmergentes(hija, s);
  });
}

function abrirLogin(id, { particion = null } = {}) {
  const s = sitio(id);
  if (!s) return Promise.resolve(null);

  const ses = particion ? session.fromPartition(particion) : session.defaultSession;

  return new Promise((resolve) => {
    const win = crearVentana({
      width: 1000, height: 800, title: `Iniciar sesión — ${s.nombre}`, autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, ...(particion ? { partition: particion } : {}) }
    });
    repartirEmergentes(win, s);

    let resuelto = false;
    const cookies = ses.cookies;
    const alCambiarCookie = (e, c) => { if (esDelLogin(`https://${String(c.domain || '').replace(/^\./, '')}/`, s)) mirar(); };
    const latido = setInterval(() => mirar(), 4000);
    const terminar = (estado) => {
      if (resuelto) return;
      resuelto = true;
      clearInterval(latido);
      cookies.removeListener('changed', alCambiarCookie);
      resolve(estado);
      if (!win.isDestroyed()) win.destroy();
    };

    let mirando = false;
    async function mirar() {
      if (resuelto || mirando || win.isDestroyed()) return;
      mirando = true;

      const r = s.cookie
        ? await cookies.get({ domain: s.dominios[0], name: s.cookie }).then(l => ({ dentro: l.length > 0 })).catch(() => null)
          .finally(() => { mirando = false; })
        : await win.webContents.executeJavaScript(SONDEO).catch(() => null)
          .finally(() => { mirando = false; });
      if (r?.dentro) {
        memoria.set(id, { dentro: true, usuario: r.usuario || '', cuando: Date.now() });
        terminar(descripcion(id));
      }
    }
    cookies.on('changed', alCambiarCookie);
    win.webContents.on('did-finish-load', mirar);
    win.on('closed', () => {
      if (resuelto) return;
      mirarDeVerdad(id).then(d => terminar(d?.dentro ? d : { ...d, cancelado: true }))
        .catch(() => terminar({ ...descripcion(id), cancelado: true }));
    });
    win.loadURL(s.login).catch(() => mirar());
  });
}

async function cerrarSesion(id) {
  const s = sitio(id);
  if (!s) return null;

  const cookies = await session.defaultSession.cookies.get({});
  let borradas = 0;
  for (const c of cookies) {
    const dominio = (c.domain || '').replace(/^\./, '');
    const suya = s.dominios.some(d => dominio === d || dominio.endsWith('.' + d));
    if (!suya) continue;

    const url = `http${c.secure ? 's' : ''}://${dominio}${c.path || '/'}`;
    try {
      await session.defaultSession.cookies.remove(url, c.name);
      borradas++;
    } catch {  }
  }

  memoria.set(id, { dentro: false, usuario: '', cuando: Date.now() });
  return { ...descripcion(id), borradas };
}

const esDelSitio = (c, s) => {
  const dominio = String(c.domain || '').replace(/^\./, '').toLowerCase();
  return s.dominios.some(d => dominio === d || dominio.endsWith('.' + d));
};

async function cookiesDelSitio(id, particion) {
  const s = sitio(id);
  if (!s) return [];
  const todas = await session.fromPartition(particion).cookies.get({});
  return todas.filter(c => esDelSitio(c, s)).map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path,
    secure: c.secure, httpOnly: c.httpOnly, hostOnly: c.hostOnly, sameSite: c.sameSite, expirationDate: c.expirationDate }));
}

async function importarCookies(id, cookies) {
  const s = sitio(id);
  if (!s || !Array.isArray(cookies)) return null;
  const MES = 30 * 24 * 3600;
  let puestas = 0;
  for (const c of cookies.slice(0, 200)) {
    if (!c || typeof c.name !== 'string' || typeof c.value !== 'string' || !esDelSitio(c, s)) continue;
    const host = String(c.domain).replace(/^\./, '');
    try {
      await session.defaultSession.cookies.set({
        url: `http${c.secure ? 's' : ''}://${host}${c.path || '/'}`, name: c.name, value: c.value,
        ...(c.hostOnly ? {} : { domain: c.domain }), path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly,
        ...(c.sameSite && c.sameSite !== 'unspecified' ? { sameSite: c.sameSite } : {}),
        expirationDate: Number(c.expirationDate) || Math.floor(Date.now() / 1000) + MES
      });
      puestas++;
    } catch {  }
  }
  await session.defaultSession.cookies.flushStore().catch(() => {});
  const visto = await comprobar(id);
  return { ...visto, puestas };
}

module.exports = { SITIOS, listar, comprobar, comprobarTodos, abrirLogin, cerrarSesion, SONDEO, sinMarcaDeElectron, esDelLogin,
  cookiesDelSitio, importarCookies, esDelSitio };
