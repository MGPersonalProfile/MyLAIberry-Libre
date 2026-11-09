const ESTADOS = ['pendiente', 'ejecutando', 'completada', 'cancelando', 'cancelada', 'fallida', 'interrumpida'];
const TERMINALES = new Set(['completada', 'cancelada', 'fallida', 'interrumpida']);

const TRANSICIONES = {
  pendiente: ['ejecutando', 'cancelada', 'interrumpida', 'fallida'],
  ejecutando: ['completada', 'cancelando', 'cancelada', 'fallida', 'interrumpida'],
  cancelando: ['cancelada', 'completada', 'fallida', 'interrumpida'],
  completada: [], cancelada: [], fallida: [], interrumpida: []
};

const MAX_HISTORIAL = 40;

const MAX_INTENTOS = 3;

const EJECUCIONES_AL_DIA = 20;

const MAX_CONCURRENTES = 2;

const TIEMPO_MAXIMO_MS = 8 * 60 * 1000;

const esTerminal = estado => TERMINALES.has(estado);

function nueva({ id, investigationId, origen = 'manual', clave = null, retryOf = null, intento = 1 }, ahora) {
  return { id, investigationId, estado: 'pendiente', fase: 'preparando', progreso: null, resultado: null, error: null,
    origen, clave, retryOf, intento, createdAt: ahora, startedAt: null, finishedAt: null, updatedAt: ahora };
}

function pasar(ej, estado, cambios = {}, ahora) {
  if (!ESTADOS.includes(estado)) throw new Error(`Estado de ejecución desconocido: ${estado}`);
  if (!TRANSICIONES[ej.estado]?.includes(estado)) throw new Error(`Una ejecución ${ej.estado} no pasa a ${estado}.`);
  Object.assign(ej, cambios, { estado, updatedAt: ahora });
  if (estado === 'ejecutando') ej.startedAt = ahora;
  if (esTerminal(estado)) ej.finishedAt = ahora;
  return ej;
}

function recortar(lista, max = MAX_HISTORIAL) {
  const terminadas = lista.filter(e => esTerminal(e.estado)).sort((a, b) => b.updatedAt - a.updatedAt);
  const fuera = new Set(terminadas.slice(max).map(e => e.id));
  return lista.filter(e => !fuera.has(e.id));
}

function publica(e) {
  return { executionId: e.id, investigationId: e.investigationId, estado: e.estado, fase: e.fase, progreso: e.progreso,
    resultado: e.resultado, error: e.error, origen: e.origen, intento: e.intento, retryOf: e.retryOf,
    createdAt: e.createdAt, startedAt: e.startedAt, finishedAt: e.finishedAt, updatedAt: e.updatedAt };
}

function normalizarLista(lista) {
  return (Array.isArray(lista) ? lista : []).filter(e => e && typeof e.id === 'string' && ESTADOS.includes(e.estado));
}

module.exports = { ESTADOS, TERMINALES, TRANSICIONES, MAX_HISTORIAL, MAX_INTENTOS, EJECUCIONES_AL_DIA, MAX_CONCURRENTES,
  TIEMPO_MAXIMO_MS, esTerminal, nueva, pasar, recortar, publica, normalizarLista };
