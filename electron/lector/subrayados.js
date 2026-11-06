const COLORES = ['amarillo', 'verde', 'azul', 'rosa', 'naranja'];
const TIPOS = ['subrayado', 'nota'];
const MAX_CITA = 4000;
const MAX_NOTA = 4000;
const MAX_RECIBOS = 2000;
const ID = /^[\w-]{1,80}$/;
const entero = n => Number.isInteger(n) && n >= 0;

function puntoValido(p, total) {
  return !!p && entero(p.bloque) && p.bloque < total && entero(p.caracter) && p.caracter <= 1000000;
}

function anclaRangoValida(a, obraId) {
  if (!a || typeof a !== 'object' || a.v !== 2) return null;
  if (a.obra !== String(obraId) || !entero(a.capitulo) || a.capitulo > 100000
    || !/^(original|[a-z]{2,8})$/.test(a.variante)
    || !entero(a.totalBloques) || a.totalBloques < 1
    || !puntoValido(a.inicio, a.totalBloques) || !puntoValido(a.fin, a.totalBloques)) return null;
  const { inicio, fin } = a;
  if (inicio.bloque > fin.bloque || (inicio.bloque === fin.bloque && inicio.caracter >= fin.caracter)) return null;
  if (typeof a.cita !== 'string' || !a.cita || a.cita.length > MAX_CITA) return null;
  if (!/^sha256:[a-f0-9]{64}$/.test(a.huella)) return null;
  const c = a.contexto;
  if (!c || typeof c.antes !== 'string' || typeof c.despues !== 'string'
    || c.antes.length > 32 || c.despues.length > 32) return null;
  return { v: 2, obra: a.obra, capitulo: a.capitulo, variante: a.variante, totalBloques: a.totalBloques,
    inicio: { bloque: inicio.bloque, caracter: inicio.caracter }, fin: { bloque: fin.bloque, caracter: fin.caracter },
    cita: a.cita, huella: a.huella, contexto: { antes: c.antes, despues: c.despues } };
}

function cambiosValidos(op, cambios, obraId) {
  const limpios = {};
  if (op.accion === 'crear') {
    const ancla = anclaRangoValida(cambios.ancla, obraId);
    if (!ancla) return { error: 'Ancla no válida' };
    limpios.ancla = ancla; limpios.tipo = 'subrayado'; limpios.color = 'amarillo'; limpios.nota = '';
  }
  if (op.accion !== 'crear' && op.accion !== 'editar') return limpios;
  if ('tipo' in cambios) {
    if (!TIPOS.includes(cambios.tipo)) return { error: 'Tipo no válido' };
    limpios.tipo = cambios.tipo;
  }
  if ('color' in cambios) {
    if (!COLORES.includes(cambios.color)) return { error: 'Color no válido' };
    limpios.color = cambios.color;
  }
  if ('nota' in cambios) {
    if (typeof cambios.nota !== 'string' || cambios.nota.length > MAX_NOTA) return { error: 'Nota no válida' };
    limpios.nota = cambios.nota;
  }
  return limpios;
}

function operacionValida(op, obraId) {
  if (!op || typeof op !== 'object') return { error: 'Operación no válida' };
  if (!ID.test(String(op.operacionId ?? '')) || !ID.test(String(op.aparatoId ?? ''))
    || !ID.test(String(op.anotacionId ?? ''))) return { error: 'Identificadores no válidos' };
  if (!['crear', 'editar', 'borrar', 'restaurar'].includes(op.accion)) return { error: 'Acción no válida' };
  if (!entero(op.revisionBase)) return { error: 'Revisión base no válida' };
  if (op.accion === 'crear' && op.revisionBase !== 0) return { error: 'Crear parte de la revisión 0' };
  const cambios = cambiosValidos(op, op.cambios || {}, obraId);
  if (cambios.error) return cambios;
  return { operacionId: op.operacionId, aparatoId: op.aparatoId, anotacionId: op.anotacionId,
    accion: op.accion, revisionBase: op.revisionBase, cambios };
}

const almacen = obra => (obra.subrayados ||= { revision: 0, items: {}, recibos: [] });

function motivoDeConflicto(op, actual) {
  if (op.accion === 'crear') return actual ? 'ya-existe' : null;
  if (!actual) return 'no-existe';
  if (op.revisionBase !== actual.revision) return actual.eliminado ? 'borrada' : 'revision-antigua';
  if (actual.eliminado && op.accion !== 'restaurar') return 'borrada';
  if (!actual.eliminado && op.accion === 'restaurar') return 'no-borrada';
  return null;
}

function aplicarOperacion(obra, op, ahora = Date.now()) {
  const a = almacen(obra);
  const recibo = a.recibos.find(r => r.aparatoId === op.aparatoId && r.operacionId === op.operacionId);
  if (recibo) return { ok: true, repetida: true, revision: recibo.revision, anotacion: a.items[op.anotacionId] || null };
  const actual = a.items[op.anotacionId];

  if (op.accion === 'crear' && actual && actual.creadaPor === op.operacionId && actual.autorAparato === op.aparatoId) {
    return { ok: true, repetida: true, revision: actual.revision, anotacion: actual };
  }
  const motivo = motivoDeConflicto(op, actual);
  if (motivo) return { ok: false, conflicto: true, motivo, revision: a.revision, actual: actual || null };
  const revision = ++a.revision;
  const registro = op.accion === 'crear'
    ? { id: op.anotacionId, obraId: String(obra.id), capitulo: op.cambios.ancla.capitulo, ...op.cambios,
      autorAparato: op.aparatoId, creadaPor: op.operacionId, creadoEn: ahora, modificadoEn: ahora, revision, eliminado: false }
    : { ...actual, ...op.cambios, modificadoEn: ahora, revision,
      eliminado: op.accion === 'borrar' ? true : op.accion === 'restaurar' ? false : actual.eliminado };
  a.items[op.anotacionId] = registro;
  a.recibos = [...a.recibos.slice(-(MAX_RECIBOS - 1)),
    { aparatoId: op.aparatoId, operacionId: op.operacionId, revision }];
  return { ok: true, escribio: true, revision, anotacion: registro };
}

function cambiosDesde(obra, desde = 0, capitulo) {
  const a = obra.subrayados || { revision: 0, items: {} };
  const lista = Object.values(a.items).filter(r => r.revision > desde
    && (capitulo === undefined || r.capitulo === capitulo)).sort((x, y) => x.revision - y.revision);
  return { revision: a.revision, anotaciones: lista };
}

module.exports = { COLORES, TIPOS, anclaRangoValida, operacionValida, aplicarOperacion, cambiosDesde };
