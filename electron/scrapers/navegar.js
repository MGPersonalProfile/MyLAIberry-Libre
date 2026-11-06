const REINTENTABLES = /ERR_FAILED|ERR_ABORTED|ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_TIMED_OUT/i;
const { detectarReto, PATRON_RETO, SELECTORES_RETO, SELECTORES_RESULTADOS } = require('../asistente-reto');
const oyentesRespuesta = new WeakMap();
function escucharRespuestaPrincipal(win, recibir) {
  const sesion = win.webContents.session;
  if (!sesion?.webRequest?.onResponseStarted) return () => {};
  let oyentes = oyentesRespuesta.get(sesion);
  if (!oyentes) {
    oyentes = new Map();
    oyentesRespuesta.set(sesion, oyentes);
    sesion.webRequest.onResponseStarted(datos => {
      if (datos.resourceType === 'mainFrame') oyentes.get(datos.webContentsId)?.(datos);
    });
  }
  oyentes.set(win.webContents.id, recibir);
  return () => oyentes.delete(win.webContents.id);
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const fechaLimite = hasta => typeof hasta === 'function' ? hasta() : hasta;

const turnos = new Map();
const ultimaPeticion = new Map();
async function conRitmo(url, tarea, minimo = 1200) {
  const sitio = sitioDe(url);
  const previo = turnos.get(sitio) || Promise.resolve();
  const turno = previo.catch(() => {}).then(async () => {
    exigirQueNoEnfrie(url);
    const espera = Math.max(0, (ultimaPeticion.get(sitio) || 0) + minimo - Date.now());
    if (espera) await dormir(espera);
    exigirQueNoEnfrie(url);
    try { return await tarea(); }
    finally { ultimaPeticion.set(sitio, Date.now()); }
  });
  const cola = turno.then(() => {}, () => {});
  turnos.set(sitio, cola);
  cola.then(() => { if (turnos.get(sitio) === cola) turnos.delete(sitio); });
  return turno;
}

async function cargarPagina(win, url, { intentos = 3, espera = 700, esperaHttpMs = 2000, presupuestoHasta } = {}) {
  return conRitmo(url, async () => {

    let codigo = 0;
    win.__mlRespuestaPrincipal = null;
    const alNavegar = (_e, _url, code) => { codigo = code || codigo; };
    win.webContents.on?.('did-navigate', alNavegar);
    const onRespuesta = datos => {
      const cabeceras = datos.responseHeaders || {};
      const valor = clave => Object.entries(cabeceras).find(([nombre]) => nombre.toLowerCase() === clave)?.[1]?.[0] || '';
      win.__mlRespuestaPrincipal = { cfMitigated: valor('cf-mitigated'), retryAfter: valor('retry-after') };
      codigo = datos.statusCode || codigo;
    };
    const dejarDeEscuchar = escucharRespuestaPrincipal(win, onRespuesta);
    try {
      return await cargarConReintentos(win, url, { intentos, espera, esperaHttpMs, presupuestoHasta },
        () => codigo, () => { codigo = 0; win.__mlRespuestaPrincipal = null; });
    } finally {
      win.webContents.removeListener?.('did-navigate', alNavegar);
      dejarDeEscuchar();
    }
  });
}

const LIMITADO = [418, 429];
const MANTENIMIENTO = /down for maintenance|under maintenance|maintenance is in progress/i;
const ENFRIAMIENTO_MANTENIMIENTO = 30 * 60 * 1000;
const limitado = (url, codigo = 429, texto = '') => {
  if (MANTENIMIENTO.test(String(texto))) {
    enfriar(url, Date.now() - ENFRIAMIENTO + ENFRIAMIENTO_MANTENIMIENTO);
    return Object.assign(new Error(`${dominio(url)} está cerrado por mantenimiento (${codigo}); suele durar horas. ` +
      'Su estado, en www.otwstatus.org para AO3. No es un bloqueo: lo de la cola espera solo.'),

      { limitado: true, mantenimiento: true, esperarMs: ENFRIAMIENTO_MANTENIMIENTO, sitio: sitioDe(url) });
  }
  enfriar(url);
  return Object.assign(
    new Error(`${dominio(url)} está limitando las peticiones (${codigo}): vuelve a intentarlo en unos minutos.`),
    { limitado: true, esperarMs: ENFRIAMIENTO, sitio: sitioDe(url) });
};
const textoDe = async (win) => {
  try { return await win.webContents.executeJavaScript('document.body ? document.body.innerText.slice(0, 2000) : ""'); } catch { return ''; }
};

const ENFRIAMIENTO = 10 * 60 * 1000;
const enfriandoHasta = new Map();

const sitioDe = (url) => { try { return new URL(url).hostname.split('.').slice(-2).join('.'); } catch { return ''; } };
function enfriar(url, ahora = Date.now()) { const s = sitioDe(url); if (s) enfriandoHasta.set(s, ahora + ENFRIAMIENTO); }
function exigirQueNoEnfrie(url, ahora = Date.now()) {
  const hasta = enfriandoHasta.get(sitioDe(url));
  if (!hasta || hasta <= ahora) return;
  const hora = new Date(hasta).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  throw Object.assign(new Error(`${dominio(url)} nos ha pedido que esperemos: no se le vuelve a pedir hasta las ${hora}.`),
    { limitado: true, esperarMs: hasta - ahora, sitio: sitioDe(url) });
}
const dominio = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'El sitio'; } };

const noExiste = (codigo, url) => Object.assign(
  new Error(`Esa página no existe (${codigo}): ${String(url).slice(0, 120)}`), { noExiste: true });

const errorHttp = (url, codigo) => Object.assign(new Error(`${dominio(url)} devolvió HTTP ${codigo}; no se pudo consultar.`),
  { codigoHttp: codigo, noConsultado: true });
const esperaDeRespuesta = (valor, minimo) => {
  const segundos = Number(valor);
  const indicado = Number.isFinite(segundos) && valor !== '' ? segundos * 1000 : Date.parse(valor) - Date.now();
  return Math.max(minimo, Number.isFinite(indicado) ? indicado : 0);
};
async function errorDeEstado(win, url, estado) {
  if (estado < 400) return null;
  const muestra = await muestraDePagina(win);
  if (detectarReto(muestra)) {
    try { exigirQueNoSeaUnReto(dominio(url), muestra); }
    catch (e) { return e; }
  }
  if ([404, 410].includes(estado)) return noExiste(estado, url);
  if (LIMITADO.includes(estado)) return limitado(url, estado, await textoDe(win));
  if ([401, 403].includes(estado) || estado >= 500 && estado <= 599) return errorHttp(url, estado);
  return null;
}

async function cargarConReintentos(win, url, { intentos, espera, esperaHttpMs = 2000, presupuestoHasta }, codigo, reiniciar = () => {}) {
  let ultimo = null;
  let reintentosHttp = 0;

  for (let intento = 1; intento <= intentos; intento++) {
    try {

      reiniciar();
      if (presupuestoHasta && Date.now() >= fechaLimite(presupuestoHasta)) throw Object.assign(
        new Error('Límite de tiempo de la investigación agotado.'), { tiempoAgotado: true, noConsultado: true });
      await win.loadURL(url);
      const fallo = await errorDeEstado(win, url, codigo());
      if (fallo) throw fallo;
      return;
    } catch (err) {
      if (codigo() >= 400 && !LIMITADO.includes(codigo()) && !err.codigoHttp && !err.reto && !err.limitado && !err.noExiste) {
        err = await errorDeEstado(win, url, codigo()) || err;
      }
      ultimo = err;
      if (win.isDestroyed() || err.limitado || err.reto || err.tiempoAgotado) throw err;

      if (err.codigoHttp) {
        if (err.codigoHttp >= 500 && reintentosHttp++ === 0) {
          const demora = esperaDeRespuesta(win.__mlRespuestaPrincipal?.retryAfter || '', esperaHttpMs);
          if (!presupuestoHasta || Date.now() + demora < fechaLimite(presupuestoHasta)) {
            await dormir(demora); intento--; continue;
          }
        }
        throw err;
      }

      if (!([404, 410].includes(codigo())) && await cargoIgualmente(win)) return;

      if (!REINTENTABLES.test(err.message) || intento === intentos) throw err;

      console.warn(`[navegar] ${err.message.split(' ')[0]} en ${url.slice(0, 70)} — intento ${intento + 1} de ${intentos}`);
      try { win.webContents.stop(); } catch {  }
      await dormir(espera * intento);
    }
  }

  throw ultimo;
}

async function cargoIgualmente(win) {
  try {
    return await win.webContents.executeJavaScript(
      '!!(document.body && document.body.innerText && document.body.innerText.length > 200)'
    );
  } catch {
    return false;
  }
}

const DENEGADO = /request temporarily denied|retry later/i;

function exigirQueNoSeaUnReto(sitio, { titulo = '', texto = '', url = '', ...senales } = {}) {
  const muestra = `${titulo} ${String(texto).slice(0, 2000)}`;
  if (detectarReto({ titulo, ...senales })) throw Object.assign(new Error(`${sitio} devolvió el reto de Cloudflare en vez de resultados.`), { reto: true, noConsultado: true });
  if (url && DENEGADO.test(muestra)) throw limitado(url, 418, muestra);

  if (url && MANTENIMIENTO.test(muestra)) throw limitado(url, 503, muestra);
  if (MANTENIMIENTO.test(muestra)) {
    throw Object.assign(new Error(`${sitio} está cerrado por mantenimiento; suele durar horas (estado de AO3: www.otwstatus.org).`),
      { limitado: true, mantenimiento: true, esperarMs: ENFRIAMIENTO_MANTENIMIENTO, sitio: sitio === 'AO3' ? 'archiveofourown.org' : '' });
  }
  if (DENEGADO.test(muestra)) throw Object.assign(new Error(`${sitio} está limitando las peticiones: vuelve a intentarlo en unos minutos.`),
    { limitado: true, esperarMs: ENFRIAMIENTO, sitio: sitio === 'AO3' ? 'archiveofourown.org' : '' });
  if (String(texto).trim().length < 200) throw new Error(`${sitio} no devolvió la página de resultados.`);
}

async function muestraDePagina(win) {
  try {
    const muestra = await win.webContents.executeJavaScript(`({ titulo: document.title,
      texto: document.body ? document.body.innerText : '', url: location.href,
      selectores: ${JSON.stringify(SELECTORES_RETO)}.filter(s => !!document.querySelector(s)),
      iframeReto: !!document.querySelector('iframe[src*="challenges.cloudflare.com"]'),
      hayResultados: !!document.querySelector(${JSON.stringify(SELECTORES_RESULTADOS)}) })`);
    return { ...muestra, cfMitigated: win.__mlRespuestaPrincipal?.cfMitigated || '' };
  } catch {
    return {};
  }
}

const FRASES_DE_RETO = ['just a moment', 'verify you are human', 'attention required', 'checking your browser', 'enable javascript and cookies',
  'un momento', 'verificación de seguridad en curso', 'comprueba que eres humano'];

const PACIENCIA = `
  function mlSigueCargando() {
    if (document.readyState !== 'complete') return true;
    var hayResultados = !!document.querySelector(${JSON.stringify(SELECTORES_RESULTADOS)});
    if (document.querySelector('#challenge-running, #challenge-form, #cf-challenge-running')) return true;
    if (!hayResultados && document.querySelector('.cf-turnstile, #turnstile-wrapper, iframe[src*="challenges.cloudflare.com"]')) return true;
    if (new RegExp(${JSON.stringify(PATRON_RETO.source)}, 'i').test(document.title || '')) return true;
    var texto = document.body ? document.body.innerText : '';
    var muestra = (!hayResultados && texto.length < 2000 ? texto : '').toLowerCase();
    var frases = ${JSON.stringify(FRASES_DE_RETO)};
    for (var i = 0; i < frases.length; i++) if (muestra.indexOf(frases[i]) >= 0) return true;
    return false;
  }
`;

const PULSO = `(function () { ${PACIENCIA}
  return { estado: document.readyState, recursos: performance.getEntriesByType('resource').length,
    largo: document.body ? document.body.innerHTML.length : 0,
    reto: document.readyState === 'complete' && mlSigueCargando() };
})()`;

async function pulsoDe(win) {
  if (win.isDestroyed()) return null;
  let p;
  try { p = await win.webContents.executeJavaScript(PULSO); } catch { p = { estado: 'navegando' }; }

  return win.isDestroyed() ? null : { ...p, cargando: win.webContents.isLoading() };
}

const ESPERA = Object.freeze({ quietoMs: 60000, cargandoMs: 300000, cada: 5000, recargasMs: [20000, 60000, 120000], retoMs: 180000,

  retoMaxMs: 900000 });

function mientrasAvance(win, promesa, etiqueta = 'la página', opciones = {}) {
  const { quietoMs, cargandoMs, cada, recargasMs, retoMs, retoMaxMs } = { ...ESPERA, ...opciones };
  let vigia;
  const muerta = new Promise((_, rechazar) => {
    let antes = '', quieto = 0, conReto = 0;
    vigia = setInterval(async () => {
      const p = await pulsoDe(win);

      if (!p) { clearInterval(vigia); rechazar(new Error(`${etiqueta}: la ventana se cerró`)); return; }
      conReto = p.reto ? conReto + 1 : 0;
      pasarElRetoSola(win, conReto * cada, cada, recargasMs);
      ensenarSiHayReto(win, conReto * cada, retoMs);
      const ahora = JSON.stringify(p);
      quieto = (ahora === antes && !p.reto) ? quieto + cada : 0;
      antes = ahora;
      if (quieto >= (p.cargando ? cargandoMs : quietoMs)) {
        rechazar(new Error(`${etiqueta}: la página dejó de responder (${p.cargando ? 'cinco minutos' : 'un minuto'} sin ninguna actividad)`));
      }
      if (conReto * cada >= retoMaxMs) {
        rechazar(new Error(`${etiqueta}: el reto de la web no se pasó en ${Math.round(retoMaxMs / 60000)} minutos`));
      }
    }, cada);

    vigia.unref?.();
  });
  return Promise.race([promesa, muerta]).finally(() => { clearInterval(vigia); ocultarTrasElReto(win); });
}

function pasarElRetoSola(win, msConReto, cada, recargasMs) {
  if (win.isDestroyed() || !msConReto) return;

  if (recargasMs.some(m => msConReto >= m && msConReto - cada < m)) {
    try { win.webContents.reload(); } catch {  }
  }
}

function ensenarSiHayReto(win, msConReto, retoMs) {
  if (win.isDestroyed()) return;
  if (msConReto >= retoMs && !win.isVisible()) {
    win.__mlEnsenadaPorReto = true;
    win.setTitle('MyLAIberry — pasa la comprobación del sitio para seguir');
    win.showInactive();
  } else if (msConReto === 0) {
    ocultarTrasElReto(win);
  }
}

function ocultarTrasElReto(win) {
  if (win.isDestroyed() || !win.__mlEnsenadaPorReto) return;
  win.__mlEnsenadaPorReto = false;
  win.hide();
}

async function ejecutarAunqueNavegue(win, guion) {
  for (;;) {
    const antes = win.isDestroyed() ? '' : win.webContents.getURL();
    try {
      return await win.webContents.executeJavaScript(guion);
    } catch (err) {

      if (win.isDestroyed() || (!win.webContents.isLoading() && win.webContents.getURL() === antes)) throw err;
      do { await dormir(1000); } while (!win.isDestroyed() && win.webContents.isLoading());
    }
  }
}

module.exports = { cargarPagina, conRitmo, sitioDe, exigirQueNoSeaUnReto, exigirQueNoEnfrie, enfriar, enfriandoHasta, limitado, muestraDePagina, PACIENCIA, mientrasAvance, ejecutarAunqueNavegue, ESPERA };
