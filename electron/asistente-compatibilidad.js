const { relacionesDe } = require('./asistente-relaciones');
const { traeCasilla } = require('./asistente-vetos-parejas');

const ESTADOS = Object.freeze({
  VETADA: 'vetada', COMPATIBLE: 'compatible_verificada', PENDIENTE: 'pendiente_verificacion',
  NO_CLASIFICADA: 'relacion_no_clasificada', INSUFICIENTES: 'datos_insuficientes'
});
const ACCION = 'abrir_ficha_web';

const etiquetasDe = (obra) => (Array.isArray(obra.tags) ? obra.tags : []).map(t => (typeof t === 'object' && t ? t : { name: String(t), category: '' }))
  .filter(t => String(t.name || '').trim());
const fandomDe = (obra) => String(obra.fandom ?? obra.fandoms?.[0] ?? obra.tags?.find?.(t => t?.category === 'fandom')?.name ?? '');

function estadoDeCompatibilidad(obra, { previa = false } = {}) {
  const etiquetas = etiquetasDe(obra);
  const relaciones = relacionesDe(etiquetas, { fandom: fandomDe(obra) });
  const sinClasificar = relaciones.filter(r => r.tipo === 'romantica' && !r.conocida);
  const completa = obra.verificacionRelaciones?.etiquetasCompletas === true;
  const base = { relaciones: relaciones.map(r => ({ crudo: r.crudo, id: r.id, tipo: r.tipo, conocida: r.conocida?.id || null })) };
  if (previa) return { ...base, estado: ESTADOS.COMPATIBLE, motivo: 'Su ficha completa se comprobó antes en esta conversación.' };
  if (sinClasificar.length) {
    return { ...base, estado: ESTADOS.NO_CLASIFICADA, accion: completa ? undefined : ACCION,
      motivo: `Lleva ${sinClasificar.length === 1 ? 'una relación' : `${sinClasificar.length} relaciones`} que no se puede${sinClasificar.length === 1 ? '' : 'n'} clasificar (${sinClasificar.map(r => r.crudo).join('; ')}): no se sabe si chocan con los disgustos y no se les inventa categoría.` };
  }
  if (!etiquetas.length) return { ...base, estado: ESTADOS.INSUFICIENTES, motivo: 'No publica etiquetas: la ausencia de etiquetas no demuestra que no tenga esas relaciones.' };
  if (!completa) return { ...base, estado: ESTADOS.PENDIENTE, accion: ACCION, motivo: 'Todavía no se ha consultado su ficha con las etiquetas completas: un listado recorta las etiquetas.' };
  if (!traeCasilla(etiquetas.map(t => t.name)) && !relaciones.some(r => r.tipo === 'romantica')) {
    return { ...base, estado: ESTADOS.INSUFICIENTES, motivo: 'Su ficha no dice su categoría (M/M, F/M, Gen…) ni publica relaciones: no hay con qué descartar el choque.' };
  }
  return { ...base, estado: ESTADOS.COMPATIBLE, motivo: 'Ficha con las etiquetas completas, sin relaciones sin clasificar ni incompatibilidades.' };
}

const esRecomendable = (estado) => estado === ESTADOS.COMPATIBLE;

module.exports = { estadoDeCompatibilidad, esRecomendable, ESTADOS, ACCION };
