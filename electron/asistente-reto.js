const PATRON_RETO = /^\s*(?:(?:just a moment|un momento)[\.…\s]*)+$|verify you are human|attention required|cf-chl|checking your browser|enable javascript and cookies|verificaci[oó]n de seguridad en curso/i;
const SELECTORES_RETO = ['#challenge-form', '#challenge-running', '#cf-challenge-running', '.cf-turnstile', '#turnstile-wrapper'];
const SELECTORES_RESULTADOS = 'li.work.blurb, li.bookmark.blurb, .z-list .z-list-item, .fiction-list-item, .story-card, .story-card-container, .search-result';

function detectarReto({ titulo = '', selectores = [], iframeReto = false, cfMitigated = '', hayResultados = false, documento } = {}) {
  if (documento) {
    selectores = SELECTORES_RETO.filter(s => !!documento.querySelector(s));
    iframeReto = !!documento.querySelector('iframe[src*="challenges.cloudflare.com"]');
    hayResultados ||= !!documento.querySelector(SELECTORES_RESULTADOS);
  }
  if (/challenge/i.test(String(cfMitigated)) || (!hayResultados && PATRON_RETO.test(String(titulo)))) return true;
  const presentes = new Set(selectores);
  if (['#challenge-form', '#challenge-running', '#cf-challenge-running'].some(s => presentes.has(s))) return true;
  return !hayResultados && (iframeReto || presentes.has('.cf-turnstile') || presentes.has('#turnstile-wrapper'));
}

const NOMBRES = { 'archiveofourown.org': 'AO3', 'www.fanfiction.net': 'FanFiction.net', 'www.royalroad.com': 'RoyalRoad', 'www.wattpad.com': 'Wattpad' };
const nombreDeSitio = direccion => { try { const h = new URL(direccion).hostname; return NOMBRES[h] || h; } catch { return 'El sitio'; } };

function sinPantalla(env = process.env, plataforma = process.platform) {
  if (env.MYLAIBERRY_SIN_PANTALLA === '1') return true;
  if (env.MYLAIBERRY_SIN_PANTALLA === '0') return false;
  if (plataforma !== 'linux') return false;
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return true;
  return /xvfb-run/i.test(env.XAUTHORITY || '');
}

const PLAZOS = Object.freeze({
  retoDesatendidoMs: 5000,
  retoPersonaMs: 60000,
  quietoMs: 30000,
  totalDesatendidoMs: 45000,
  totalPersonaMs: 180000,
  cada: 500, cadaVigia: 5000
});

function planDeReto({ origen, env = process.env, plataforma = process.platform, ventanaMostrable = true,
  powerMonitor, bloqueada = false, plazos = {} } = {}) {
  const p = { ...PLAZOS, ...plazos };
  const desdeElMovil = origen === 'movil';
  const ausenteWindows = plataforma === 'win32' && (bloqueada || powerMonitor?.getSystemIdleState?.(120) === 'locked'
    || (powerMonitor?.getSystemIdleTime?.() ?? 0) >= 120);
  const puedeResolverReto = origen === 'local' && !sinPantalla(env, plataforma) && !ausenteWindows && !!ventanaMostrable;
  const motivo = puedeResolverReto ? '' : desdeElMovil ? 'movil' : sinPantalla(env, plataforma) ? 'sin-pantalla' : 'sin-persona';
  return { puedeResolverReto, desdeElMovil, motivo,
    retoMs: puedeResolverReto ? p.retoPersonaMs : p.retoDesatendidoMs,
    totalMs: puedeResolverReto ? p.totalPersonaMs : p.totalDesatendidoMs,
    quietoMs: p.quietoMs, cada: p.cada, cadaVigia: p.cadaVigia };
}

const avisoDuranteElReto = (sitio, plan) => plan.desdeElMovil
  ? `${sitio} está pidiendo una comprobación humana. Como estás usando el asistente desde el móvil, no puedo resolverla aquí.`
  : `${sitio} está pidiendo una comprobación humana y aquí no hay nadie delante para resolverla.`;
const avisoAlAbandonar = sitio => `No he podido consultar ${sitio} porque pide una comprobación humana. Continúo buscando en los demás sitios.`;

const conTope = (promesa, ms, vacio) => {
  let reloj;
  const tope = new Promise(resolve => { reloj = setTimeout(() => resolve(vacio), ms); });
  return Promise.race([promesa, tope]).finally(() => clearTimeout(reloj));
};
const tiempoAgotado = () => Object.assign(new Error('Límite de tiempo de la investigación agotado.'),
  { tiempoAgotado: true, noConsultado: true });

async function explicarAbandono(win, causa, { muestraDePagina, exigirQueNoSeaUnReto }) {
  const viva = win && !win.isDestroyed();
  const titulo = viva ? win.webContents.getTitle() : '';
  const muestra = viva ? await conTope(muestraDePagina(win), 2000, {}) : {};
  const lectura = { ...muestra, titulo: `${titulo} ${muestra.titulo || ''}` };
  const marcar = e => Object.assign(e, { noConsultado: true });
  if (lectura.titulo.trim() || muestra.texto || muestra.cfMitigated || muestra.selectores?.length) {
    try { exigirQueNoSeaUnReto('La investigación', lectura); }
    catch (reto) { if (reto.limitado || /reto de Cloudflare/.test(reto.message)) return marcar(Object.assign(reto, { reto: !reto.limitado })); }
  }
  return marcar(Object.assign(causa, { reto: causa.reto || false }));
}

async function alAbandonar(e, { ventana, lectores, cerrar, progreso, sitio, alAbandonarReto }) {
  const win = ventana();
  const direccion = win && !win.isDestroyed() ? win.webContents.getURL() : '';
  const error = await explicarAbandono(win, e, lectores);
  cerrar();
  if (error.reto) {

    alAbandonarReto?.({ sitio, url: direccion });
    progreso({ estado: 'comprobacion', mensaje: avisoAlAbandonar(sitio) });
  }
  return error;
}

function relojDeLaEspera() {
  let pausado = 0, desde = 0;
  return { empezar() { desde = Date.now(); }, terminar() { const ms = Date.now() - desde; pausado += ms; desde = 0; return ms; },
    get suspendido() { return !!desde; },
    transcurrido: inicio => Date.now() - inicio - pausado - (desde ? Date.now() - desde : 0) };
}

async function conPlazo({ promesa, ventana, plan, presupuestoHasta = Infinity, sitio, progreso, mientrasAvance, cerrar, alAbandonarReto,
  esperarDirector, esperaDirectorMs = 0, alTerminarEspera, ...lectores }) {
  const planAhora = typeof plan === 'function' ? plan : () => plan;
  const fechaLimite = () => typeof presupuestoHasta === 'function' ? presupuestoHasta() : presupuestoHasta;
  const inicial = planAhora();
  let abandonar, retoDesde = 0, sondeando = false, presenciaAnterior = inicial.puedeResolverReto;
  const empezo = Date.now(); const fuera = new Promise((_, no) => { abandonar = no; });
  const pedir = Promise.race([promesa, fuera]); const maximo = Math.max(inicial.totalMs, PLAZOS.totalPersonaMs);
  const espera = relojDeLaEspera();
  const armar = ms => setTimeout(() => {
    const resto = maximo - espera.transcurrido(empezo);
    if (resto > 50) { techo = armar(resto); return; }
    abandonar(Date.now() >= fechaLimite() ? tiempoAgotado()
      : new Error(`La investigación: ${sitio} no terminó en ${Math.round(planAhora().totalMs / 1000)} s.`));
  }, ms);
  let techo = armar(maximo);
  const esperaAlDirector = async win => {
    espera.empezar();
    try { return await esperarDirector({ win, sitio, url: win.webContents.getURL() }) === 'resuelto'; }
    finally { alTerminarEspera?.(espera.terminar()); }
  };
  const mirar = setInterval(async () => {
    if (sondeando) return;
    sondeando = true;
    try {
      const actual = planAhora();
      if (Date.now() >= fechaLimite()) { abandonar(tiempoAgotado()); return; }
      if (espera.transcurrido(empezo) >= actual.totalMs) {
        abandonar(new Error(`La investigación: ${sitio} no terminó en ${Math.round(actual.totalMs / 1000)} s.`)); return;
      }
      const win = ventana();
      if (!win || win.isDestroyed()) return;
    if (presenciaAnterior !== actual.puedeResolverReto) {
      presenciaAnterior = actual.puedeResolverReto;
      if (!actual.puedeResolverReto && win.__mlEnsenadaPorReto) { win.hide(); win.__mlEnsenadaPorReto = false; }
      if (retoDesde) retoDesde = Date.now();
    }
    const muestra = await conTope(lectores.muestraDePagina(win), actual.cada, {});
    if (win.isDestroyed()) return;
    if (!detectarReto({ ...muestra, titulo: `${win.webContents.getTitle()} ${muestra.titulo || ''}` })) { retoDesde = 0; return; }
    if (!retoDesde) {
      retoDesde = Date.now();
      progreso({ estado: 'comprobacion', ...(actual.puedeResolverReto ? {} : { mensaje: avisoDuranteElReto(sitio, actual) }) });
    }
    if (actual.puedeResolverReto && !win.isVisible()) { win.setTitle('MyLAIberry — comprobación del sitio'); win.showInactive(); win.__mlEnsenadaPorReto = true; }
    if (Date.now() - retoDesde >= actual.retoMs) {

      if (esperarDirector && !actual.puedeResolverReto && await esperaAlDirector(win)) { retoDesde = 0; return; }
      abandonar(Object.assign(new Error(`La investigación: ${sitio} pide una comprobación humana.`), { reto: true }));
    }
    } finally { sondeando = false; }
  }, inicial.cada);
  try {
    return await mientrasAvance(ventana(), pedir, 'La investigación',
      { quietoMs: inicial.quietoMs, cada: inicial.cadaVigia, retoMs: Infinity, retoMaxMs: Math.max(inicial.totalMs, PLAZOS.totalPersonaMs) + (esperarDirector ? esperaDirectorMs : 0), recargasMs: [] });
  } catch (e) {
    throw await alAbandonar(e, { ventana, lectores, cerrar, progreso, sitio, alAbandonarReto });
  } finally {
    clearTimeout(techo); clearInterval(mirar);
    const win = ventana();
    if (win && !win.isDestroyed() && win.isVisible()) win.hide();
  }
}

module.exports = { conPlazo, PATRON_RETO, SELECTORES_RETO, SELECTORES_RESULTADOS, detectarReto,
  PLAZOS, sinPantalla, planDeReto, nombreDeSitio, avisoDuranteElReto, avisoAlAbandonar };
