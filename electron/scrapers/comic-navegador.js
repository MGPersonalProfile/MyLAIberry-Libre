const { cargarPagina, PACIENCIA, mientrasAvance, ejecutarAunqueNavegue, muestraDePagina, exigirQueNoSeaUnReto, sitioDe } = require('./navegar.js');
const { crearVentanaDeComic, verificarUrlDeVentana } = require('./ventana-aislada.js');
const { sinPantalla, detectarReto } = require('../asistente-reto.js');

const DOMINIO = /(^|\.)asurascans\.com$/;

const TECHO_SIN_PANTALLA_MS = 3 * 60 * 1000;
const TECHO_MS = 10 * 60 * 1000;
const RETO_MAX_SIN_PANTALLA_MS = 90 * 1000;

const guionDeEspera = (selector, maxTotal = 1200) => `${PACIENCIA}
  new Promise(resolve => {
    let vueltas = 0, total = 0;
    const sondeo = setInterval(() => {
      total++;
      if (!mlSigueCargando()) vueltas++;
      if (document.querySelector(${JSON.stringify(selector)}) || vueltas > 12 || total > ${Number(maxTotal)}) {
        clearInterval(sondeo);
        resolve();
      }
    }, 500);
  });`;

const techoDe = () => sinPantalla() ? TECHO_SIN_PANTALLA_MS : TECHO_MS;

async function cargar(win, url) {
  try { await cargarPagina(win, url); } catch (err) {
    if (!err.reto || win.isDestroyed()) throw err;
  }
}

async function paginaRenderizada(url, { esperar, dominio = DOMINIO } = {}) {
  const u = await require('../asistente-web-libre.js').comprobarDestino(url);
  if (dominio && !dominio.test(u.hostname.toLowerCase())) throw new Error('fuera del sitio');
  const win = crearVentanaDeComic({ show: false, width: 1280, height: 900, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } },
    { dominio });
  let reloj;
  try {
    const techo = new Promise((_, no) => {
      reloj = setTimeout(async () => {
        let reto = false;
        try { reto = !win.isDestroyed() && detectarReto(await muestraDePagina(win)); } catch {  }
        no(Object.assign(new Error(`${url}: la página no terminó de montarse en ${Math.round(techoDe() / 60000)} min`),
          reto ? { reto: true, sitio: sitioDe(url) } : {}));
      }, techoDe());
      reloj.unref?.();
    });
    const opciones = sinPantalla() ? { retoMaxMs: RETO_MAX_SIN_PANTALLA_MS } : {};
    return await Promise.race([techo, mientrasAvance(win, (async () => {
      await cargar(win, url);
      await ejecutarAunqueNavegue(win, guionDeEspera(esperar));
      const actual = win.webContents.getURL();
      if (actual) verificarUrlDeVentana(actual, dominio);
      const listo = esperar ? await ejecutarAunqueNavegue(win, `Boolean(document.querySelector(${JSON.stringify(esperar)}))`) : true;
      if (!listo) {
        const muestra = await muestraDePagina(win);
        if (detectarReto(muestra)) exigirQueNoSeaUnReto(sitioDe(url) || url, { ...muestra, url: actual || url });
      }
      return ejecutarAunqueNavegue(win, 'document.documentElement.outerHTML');
    })(), url, opciones)]);
  } finally {
    clearTimeout(reloj);
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { paginaRenderizada, guionDeEspera, techoDe, DOMINIO };
