const crypto = require('node:crypto');
const { capturarRecuperable } = require('./captura-recuperable.js');

const LIMITES = Object.freeze({
  ttlSesionMs: 5 * 60 * 1000,
  anchoMax: 720, calidad: 65,
  minFotogramaMs: 900,
  minFotogramaRafagaMs: 450,
  rafagaMs: 3000,
  minToqueMs: 250,
  fotogramaVigenteMs: 10000,
  maxFallos: 5,
  pausaMs: 60 * 1000,
  toquesRecordados: 32
});

const error = (codigo, mensaje) => Object.assign(new Error(mensaje), { codigo });
const MENSAJES = {
  'pausado': 'Demasiados intentos con un token que no es: espera un minuto.', 'sin-sesion': 'No hay una sesión de control abierta.',
  'caducado': 'La sesión caducó.', 'ocupado': 'Otro dispositivo ya está pasando esta comprobación.',
  'fotograma-caducado': 'Esa imagen ya no es la última: espera a la siguiente.', 'viewport-distinto': 'La ventana cambió de tamaño: espera a la siguiente imagen.',
  'fuera-de-imagen': 'El toque cae fuera de la página.', 'tipo-no-permitido': 'Sólo se admiten toques.', 'toque-sin-id': 'Cada toque lleva un identificador.',
  'limitado': 'Demasiado deprisa.', 'ventana-destruida': 'La ventana de este reto ya no existe.'
};
const falla = codigo => error(codigo, MENSAJES[codigo] || codigo);

function traducirToque({ x, y } = {}, { w, h }) {
  const bueno = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (!bueno(x) || !bueno(y)) throw falla('fuera-de-imagen');
  return { x: Math.min(w - 1, Math.round(x * w)), y: Math.min(h - 1, Math.round(y * h)) };
}

function mismoSitio(destino, origenFijado) {
  try {
    const d = new URL(destino), o = new URL(origenFijado);
    return ['http:', 'https:'].includes(d.protocol) && d.hostname.toLowerCase() === o.hostname.toLowerCase()
      && d.port === o.port && !d.username && !d.password;
  } catch { return false; }
}

function crearRemoto({ gestor, ahora = Date.now, politicaNavegacion = mismoSitio, limites = {} } = {}) {
  const L = { ...LIMITES, ...limites };
  const sesiones = new Map();
  const fallos = new Map();

  function autorizar(retoId, autorizacion) {
    try {

      return gestor.paraRemoto(retoId, autorizacion);
    } catch (e) {
      if (e.codigo === 'no-autorizado') throw errorDeToken(retoId);
      if (e.codigo === 'sin-reto') fallos.delete(retoId);
      if (e.codigo === 'sin-sesion') cerrar(retoId);
      throw e.codigo ? e : falla('sin-sesion');
    }
  }
  function errorDeToken(retoId) {
    const f = fallos.get(retoId) || { n: 0, hasta: 0, ultimo: 0 };
    if (ahora() < f.hasta) return falla('pausado');

    f.n = (f.hasta || ahora() - f.ultimo >= L.pausaMs) ? 1 : f.n + 1;
    f.hasta = 0;
    f.ultimo = ahora();
    if (f.n >= L.maxFallos) { f.hasta = ahora() + L.pausaMs; f.n = 0; }
    fallos.set(retoId, f);
    return error('no-autorizado', 'No estás autorizado para este reto.');
  }

  function cerrar(retoId) {
    const s = sesiones.get(retoId);
    if (!s) return;
    sesiones.delete(retoId);
    for (const [emisor, evento, fn] of s.oyentes) emisor.removeListener?.(evento, fn);
    s.oyentes.length = 0;
    try { gestor.marcarIntervencion(retoId, false); } catch {  }
  }

  function vigente(retoId, autorizacion) {
    const { ventana, caducaEn, ventanaDe } = autorizar(retoId, autorizacion);
    const s = sesiones.get(retoId);
    if (!s) throw falla('sin-sesion');
    if (ahora() >= s.caducaEn || ahora() >= caducaEn) { cerrar(retoId); throw falla('caducado'); }
    if (s.win.isDestroyed()) { cerrar(retoId); throw falla('ventana-destruida'); }
    if (ventana !== s.win || ventanaDe?.() !== s.win) { cerrar(retoId); throw falla('sin-sesion'); }
    return s;
  }

  async function iniciar(retoId, autorizacion, { cliente = null } = {}) {
    const { ventana, caducaEn } = autorizar(retoId, autorizacion);
    const existente = sesiones.get(retoId);
    if (existente) {
      if (existente.cliente !== cliente) throw falla('ocupado');
      return { ok: true, caducaEn: existente.caducaEn, viewport: existente.viewportActual() };
    }
    const wc = ventana.webContents;
    const origen = wc.getURL();
    const s = { cliente, win: ventana, origen, caducaEn: Math.min(ahora() + L.ttlSesionMs, caducaEn), oyentes: [], contador: 0,
      ultimo: null, enCaptura: null, rafagaHasta: 0, ultimoToque: 0, toques: [],
      viewportActual: () => { const [w, h] = ventana.getContentSize(); return { w, h }; } };

    const vigilar = (evento, destino) => {
      if (politicaNavegacion(destino, origen)) return;
      evento?.preventDefault?.();
      cerrar(retoId);
    };
    const alDestruir = () => cerrar(retoId);
    for (const [emisor, evento, fn] of [[wc, 'will-navigate', vigilar], [wc, 'will-redirect', vigilar], [ventana, 'closed', alDestruir]]) {
      emisor.on(evento, fn);
      s.oyentes.push([emisor, evento, fn]);
    }
    wc.setWindowOpenHandler?.(() => ({ action: 'deny' }));
    sesiones.set(retoId, s);
    gestor.alCerrar(retoId, () => cerrar(retoId));
    gestor.marcarIntervencion(retoId, true);
    return { ok: true, caducaEn: s.caducaEn, viewport: s.viewportActual() };
  }

  const salida = (f, ultimo, s) => (f.id === ultimo
    ? { id: f.id, igual: true, viewport: f.viewport, ancho: f.ancho, alto: f.alto, cadenciaMs: cadencia(s) }
    : { id: f.id, jpeg: f.jpeg, viewport: f.viewport, ancho: f.ancho, alto: f.alto, cadenciaMs: cadencia(s) });
  const cadencia = s => (ahora() < s.rafagaHasta ? L.minFotogramaRafagaMs : L.minFotogramaMs);

  async function capturar(retoId, s) {
    const imagen = await capturarRecuperable(s.win.webContents);
    if (sesiones.get(retoId) !== s) throw falla('sin-sesion');
    const tamano = imagen.getSize();
    const reducida = tamano.width > L.anchoMax ? imagen.resize({ width: L.anchoMax }) : imagen;
    const jpeg = reducida.toJPEG(L.calidad);
    const hash = crypto.createHash('sha1').update(jpeg).digest('hex');
    const { width: ancho, height: alto } = reducida.getSize();
    if (s.ultimo && s.ultimo.hash === hash) { s.ultimo.en = ahora(); return s.ultimo; }
    s.ultimo = { id: ++s.contador, hash, jpeg, en: ahora(), viewport: s.viewportActual(), ancho, alto };
    return s.ultimo;
  }

  async function fotograma(retoId, autorizacion, { ultimo = null } = {}) {
    const s = vigente(retoId, autorizacion);
    if (s.ultimo && ahora() - s.ultimo.en < cadencia(s)) return salida(s.ultimo, ultimo, s);
    s.enCaptura ||= capturar(retoId, s).finally(() => { s.enCaptura = null; });
    return salida(await s.enCaptura, ultimo, s);
  }

  async function tocar(retoId, autorizacion, toque = {}) {
    const s = vigente(retoId, autorizacion);
    if (toque.tipo !== undefined && toque.tipo !== 'toque') throw falla('tipo-no-permitido');
    for (const k of ['tecla', 'texto', 'codigo', 'script', 'boton', 'button']) if (k in toque) throw falla('tipo-no-permitido');
    if (typeof toque.id !== 'string' || !toque.id || toque.id.length > 80) throw falla('toque-sin-id');
    if (s.toques.includes(toque.id)) return { ok: true, repetido: true };
    const punto = traducirToque(toque, s.viewportActual());
    const f = s.ultimo;
    if (!f || toque.frame !== f.id || ahora() - f.en > L.fotogramaVigenteMs) throw falla('fotograma-caducado');
    const ahoraMismo = s.viewportActual();
    if (ahoraMismo.w !== f.viewport.w || ahoraMismo.h !== f.viewport.h) throw falla('viewport-distinto');
    if (ahora() - s.ultimoToque < L.minToqueMs) throw falla('limitado');
    s.ultimoToque = ahora();
    s.toques.push(toque.id);
    if (s.toques.length > L.toquesRecordados) s.toques.shift();
    s.rafagaHasta = ahora() + L.rafagaMs;
    const wc = s.win.webContents;
    wc.sendInputEvent({ type: 'mouseMove', ...punto });
    wc.sendInputEvent({ type: 'mouseDown', ...punto, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', ...punto, button: 'left', clickCount: 1 });
    return { ok: true, rafagaMs: L.rafagaMs };
  }

  async function estado(retoId, autorizacion) {
    const { reto, caducaEn } = autorizar(retoId, autorizacion);
    const s = sesiones.get(retoId);
    return { disponible: !!reto.remoto, activa: !!s, caducaEn: s ? s.caducaEn : caducaEn, restanteMs: s ? Math.max(0, s.caducaEn - ahora()) : 0,
      viewport: s?.viewportActual() || null, ultimo: s?.ultimo?.id || 0 };
  }

  async function finalizar(retoId, autorizacion) {
    autorizar(retoId, autorizacion);
    cerrar(retoId);
    return { ok: true };
  }

  const recursos = () => ({ sesiones: sesiones.size, oyentes: [...sesiones.values()].reduce((n, s) => n + s.oyentes.length, 0) });
  const cerrarTodo = () => { for (const id of [...sesiones.keys()]) cerrar(id); };
  return { iniciar, estado, fotograma, tocar, finalizar, recursos, cerrarTodo };
}

module.exports = { crearRemoto, traducirToque, mismoSitio, LIMITES };
