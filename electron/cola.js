const { getTrabajos, setTrabajos, origenesDeObras } = require('./db.js');

const RESPIRO_POR_DEFECTO = 1500;
const INTENTOS_MAXIMOS = 3;

const manejadores = new Map();
let enVuelo = false;
let temporizador = null;

let parada = false;
let arrancada = false;
let cambiosPendientes = Promise.resolve();
let confirmarResultado = null;
let despertarPendiente = false;

function cambiarLista(cambiar) {
  const trabajo = cambiosPendientes.then(async () => {
    const lista = await getTrabajos();
    const nueva = cambiar(lista);
    if (nueva === null) return false;
    await setTrabajos(nueva);
    return true;
  });
  cambiosPendientes = trabajo.catch(() => {});
  return trabajo;
}

class ErrorDeRitmo extends Error {
  constructor(mensaje, esperarMs) {
    super(mensaje);
    this.name = 'ErrorDeRitmo';
    this.esperarMs = esperarMs;
  }
}

function clave(tipo, carga) {
  return `${tipo}|${JSON.stringify(carga ?? null)}`;
}

function registrar(tipo, fn, { respiro = RESPIRO_POR_DEFECTO } = {}) {
  manejadores.set(tipo, { fn, respiro });
}

async function encolar(tipo, carga, { prioritario = false } = {}) {
  const k = clave(tipo, carga);

  const tarea = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    carga: carga ?? null,
    intentos: 0,
    noAntesDe: 0,
    creadaEn: Date.now()
  };

  const agregada = await cambiarLista(lista => {
    const ya = lista.find(t => clave(t.tipo, t.carga) === k);

    if (ya) return prioritario && lista[0] !== ya ? [ya, ...lista.filter(t => t !== ya)] : null;
    return prioritario ? [tarea, ...lista] : [...lista, tarea];
  });
  if (agregada) procesar();
  return agregada;
}

async function encolarVarias(tipo, cargas = [], { prioritario = false } = {}) {
  if (!Array.isArray(cargas) || cargas.length === 0) return 0;

  let entradas = [];
  await cambiarLista(lista => {
    const conocidas = new Set(lista.map(t => clave(t.tipo, t.carga)));
    entradas = [];

    for (const carga of cargas) {
      const k = clave(tipo, carga);
      if (conocidas.has(k)) continue;
      conocidas.add(k);
      entradas.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        carga: carga ?? null,
        intentos: 0,
        noAntesDe: 0,
        creadaEn: Date.now()
      });
    }

    if (entradas.length === 0) return null;
    return prioritario ? [...entradas, ...lista] : [...lista, ...entradas];
  });

  if (entradas.length > 0) procesar();
  return entradas.length;
}

async function quitar(id) {
  await cambiarLista(lista => lista.filter(t => t.id !== id));
}

async function devolver(tarea, { alFrente = false } = {}) {
  await cambiarLista(actual => {
    const lista = actual.filter(t => t.id !== tarea.id);
    return alFrente ? [tarea, ...lista] : [...lista, tarea];
  });
}

function programar(ms) {
  clearTimeout(temporizador);

  if (parada) return;
  temporizador = setTimeout(procesar, ms);
}

function trasElFallo(tarea, err) {

  tarea.ultimoError = String(err?.message || err).slice(0, 300);

  if (err instanceof ErrorDeRitmo || err?.limitado) {

    tarea.noAntesDe = Date.now() + (err.esperarMs || 10 * 60 * 1000);
    console.warn(`[Cola] ${tarea.tipo}: ${err.message}. Pausa de ${Math.round((err.esperarMs || 600000) / 60000)} min.`);
    return () => devolver(tarea, { alFrente: true });
  }

  tarea.intentos = (tarea.intentos || 0) + 1;
  if (tarea.intentos >= INTENTOS_MAXIMOS) {
    console.warn(`[Cola] ${tarea.tipo} descartada tras ${tarea.intentos} intentos: ${err.message}`);
    return () => quitar(tarea.id);
  }

  tarea.noAntesDe = Date.now() + tarea.intentos * tarea.intentos * 60 * 1000;
  console.warn(`[Cola] ${tarea.tipo} falló (intento ${tarea.intentos}): ${err.message}`);
  return () => devolver(tarea);
}

const SIEMPRE_TUYOS = new Set(['comprobar-capitulos']);

const DE_UNA_OBRA = new Set(['descargar-capitulos', 'traducir-sinopsis', 'clasificar-genero', 'audio-capitulo']);

function esDeTuBiblioteca(tarea, origenes) {
  if (SIEMPRE_TUYOS.has(tarea.tipo)) return true;
  if (!DE_UNA_OBRA.has(tarea.tipo)) return false;
  const origen = origenes[String(tarea.carga?.fanficId)];
  return origen !== undefined && origen !== 'descubierta' && origen !== 'descartada';
}

function elegirTarea(lista, ahora, origenes = {}) {
  const listas = lista.filter(t => manejadores.has(t.tipo) && (t.noAntesDe || 0) <= ahora);

  const tarea = listas.find(t => esDeTuBiblioteca(t, origenes)) || listas[0];
  if (tarea) return { tarea };

  const esperas = lista
    .filter(t => manejadores.has(t.tipo))
    .map(t => (t.noAntesDe || 0) - ahora)
    .filter(ms => ms > 0);

  return { tarea: null, esperar: esperas.length > 0 ? Math.min(...esperas) : null };
}

async function procesar() {

  if (!arrancada || parada) return;
  if (enVuelo) { despertarPendiente = true; return; }
  enVuelo = true;
  despertarPendiente = false;
  let siguiente = null;
  let sinTrabajoListo = false;

  try {

    if (confirmarResultado) {
      await confirmarResultado();
      confirmarResultado = null;
    }

    const lista = await getTrabajos();
    if (lista.length === 0) { sinTrabajoListo = true; return; }

    const { tarea, esperar } = elegirTarea(lista, Date.now(), await origenesDeObras().catch(() => ({})));
    if (!tarea) {
      sinTrabajoListo = true;
      siguiente = esperar;
      return;
    }

    const { fn, respiro } = manejadores.get(tarea.tipo);
    siguiente = respiro;

    try {
      await fn(tarea.carga);
      confirmarResultado = () => quitar(tarea.id);
    } catch (err) {
      confirmarResultado = trasElFallo(tarea, err);
    }

    await confirmarResultado();
    confirmarResultado = null;
  } catch (err) {
    console.warn(`[Cola] No se pudo guardar o leer el estado; se reintentará: ${err.message}`);
    siguiente = RESPIRO_POR_DEFECTO;
  } finally {
    enVuelo = false;
    if (sinTrabajoListo && despertarPendiente) siguiente = 0;
    if (siguiente !== null) programar(siguiente);
  }
}

async function arrancar() {
  arrancada = true;
  parada = false;
  await procesar();
}

async function pendientes() {
  return await getTrabajos();
}

function enCurso() {
  return enVuelo;
}

function parar() {
  parada = true;
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
}

function enMarcha() {
  return arrancada && !parada;
}

module.exports = { registrar, encolar, encolarVarias, arrancar, parar, enMarcha, pendientes, enCurso, elegirTarea, ErrorDeRitmo };
