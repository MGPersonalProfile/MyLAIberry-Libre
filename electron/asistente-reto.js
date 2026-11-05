const PATRON_RETO = /just a moment|verify you are human|attention required|cf-chl|checking your browser|enable javascript and cookies|un momento|verificaci[oó]n de seguridad en curso/i;

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

function planDeReto({ origen, env = process.env, plataforma = process.platform, ventanaMostrable = true, plazos = {} } = {}) {
  const p = { ...PLAZOS, ...plazos };
  const desdeElMovil = origen === 'movil';
  const puedeResolverReto = origen === 'local' && !sinPantalla(env, plataforma) && !!ventanaMostrable;
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

async function explicarAbandono(win, causa, { muestraDePagina, exigirQueNoSeaUnReto }) {
  const viva = win && !win.isDestroyed();
  const titulo = viva ? win.webContents.getTitle() : '';
  const muestra = viva ? await conTope(muestraDePagina(win), 2000, {}) : {};
  const lectura = { ...muestra, titulo: `${titulo} ${muestra.titulo || ''}` };
  const marcar = e => Object.assign(e, { noConsultado: true });
  if (lectura.titulo.trim() || muestra.texto) {
    try { exigirQueNoSeaUnReto('La investigación', lectura); }
    catch (reto) { if (reto.limitado || /reto de Cloudflare/.test(reto.message)) return marcar(Object.assign(reto, { reto: !reto.limitado })); }
  }
  return marcar(Object.assign(causa, { reto: causa.reto || false }));
}

async function conPlazo({ promesa, ventana, plan, sitio, progreso, mientrasAvance, cerrar, ...lectores }) {
  let abandonar, retoDesde = 0;
  const fuera = new Promise((_, no) => { abandonar = no; });
  const pedir = Promise.race([promesa, fuera]);
  const techo = setTimeout(() => abandonar(new Error(`La investigación: ${sitio} no terminó en ${Math.round(plan.totalMs / 1000)} s.`)), plan.totalMs);
  const mirar = setInterval(() => {
    const win = ventana();
    if (!win || win.isDestroyed()) return;
    if (!PATRON_RETO.test(win.webContents.getTitle())) { retoDesde = 0; return; }
    if (!retoDesde) {
      retoDesde = Date.now();
      if (plan.puedeResolverReto && !win.isVisible()) { win.setTitle('MyLAIberry — comprobación del sitio'); win.showInactive(); win.__mlEnsenadaPorReto = true; }
      progreso({ estado: 'comprobacion', ...(plan.puedeResolverReto ? {} : { mensaje: avisoDuranteElReto(sitio, plan) }) });
    }
    if (Date.now() - retoDesde >= plan.retoMs) abandonar(Object.assign(new Error(`La investigación: ${sitio} pide una comprobación humana.`), { reto: true }));
  }, plan.cada);
  try {
    return await mientrasAvance(ventana(), pedir, 'La investigación',
      { quietoMs: plan.quietoMs, cada: plan.cadaVigia, retoMs: Infinity, retoMaxMs: plan.totalMs, recargasMs: [] });
  } catch (e) {
    const win = ventana();
    const error = await explicarAbandono(win, e, lectores);
    cerrar();
    if (error.reto) progreso({ estado: 'comprobacion', mensaje: avisoAlAbandonar(sitio) });
    throw error;
  } finally {
    clearTimeout(techo); clearInterval(mirar);
    const win = ventana();
    if (win && !win.isDestroyed() && win.isVisible()) win.hide();
  }
}

module.exports = { conPlazo, PATRON_RETO, PLAZOS, sinPantalla, planDeReto, nombreDeSitio, avisoDuranteElReto, avisoAlAbandonar };
