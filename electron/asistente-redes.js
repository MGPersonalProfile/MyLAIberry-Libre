const { prometeConfirmacion, CORRECCION_TARJETA } = require('./asistente-app-ejecutar');
const { enlacesInventados, CORRECCION_ENLACES } = require('./asistente-enlaces');
const c = require('./asistente-comprobado');
const { retiradasNombradas } = require('./asistente-vetos-salida');

const PIE = ' Este aviso es del sistema: el usuario no lo ve. No le pidas perdón ni lo menciones; contesta a su mensaje. ' +
  'Si lo que afirmabas es de un turno anterior de esta conversación (está en el historial, con su llamada), dilo así, como algo ya hecho antes.';

const PREGUNTA_POR_LO_HECHO = /\b(?:has|hab[eé]is|hemos)\s+vuelto\s+a\s+\w+r\b|\b(?:has|ha|han|hab[eé]is|hemos|hab[ií]as)\s+(?:\w+\s+)?(?:hecho|guardado|puesto|exportado|importado|borrado|quitado|a[ñn]adido|cambiado|dejado|apuntado|traducido|creado|marcado|deshecho|metido|sacado|seguido|descargado|descartado)\b|\b(?:hiciste|hicimos|guardaste|pusiste|exportaste|importaste|borraste|quitaste|a[ñn]adiste|cambiaste|dejaste|apuntaste|metiste|sacaste|seguiste|descargaste|descartaste)\b|\bwhat (?:have we|did (?:we|you)) (?:done|do)\b|\bwhere did you (?:save|put)\b/i;

const PIDE_NOMBRES_INTERNOS = /^(?!.*\bno\b[^.?!]{0,25}\bnombres?\b).*(?:\bnombres?\s+(?:internos?|t[eé]cnicos?|reales?)\b|\bnombres?\s+de\s+(?:tus|las)\s+herramientas\b|\bc[oó]mo\s+se\s+llaman?\s+(?:tus|las|los)\s+(?:herramientas|funciones|campos|ajustes)\b|\binternal names?\b)/is;

const PIDE_TODAS = /^(?!.*\b(?:excepto|menos|salvo|except|but)\b).*\b(?:todas|las\s+dos|ambas|all\s+of\s+them|both)\b/is;

const ES_PREGUNTA = /\?|^\s*¿|^\s*(?:qu[eé]|d[oó]nde|c[oó]mo|cu[aá]l(?:es)?|cu[aá]nd[oa]|has|hab[eé]is|hemos|hiciste|hicimos|what|where|did)\b/i;

const SOLO_MIRA = /^(?:biblioteca|estanterias|gustos|avisos|investigaciones|autores_seguidos|ideas_apuntadas|uso_del_asistente|sesiones|comprobar_sesiones|descargas_en_curso|consultar_notas|buscar_obras|buscar_recomendaciones|buscar_escena|ver_ajustes|ver_escena|reglas_de_traduccion|obras_del_autor|navegar_web|buscar_en_internet|donde_esta_el_libro)$/;
const cambioAlgo = (nombre) => {
  const delCatalogo = require('./asistente-app').CATALOGO.find(e => e.nombre === nombre);
  return delCatalogo ? delCatalogo.nivel !== 'lectura' : !SOLO_MIRA.test(nombre);
};

const REDES = [

  ['vetada', (t, x) => retiradasNombradas(t, x.registroVetos).length,
    (t, x) => `[Aviso del sistema, no del usuario] Tu respuesta nombra ${retiradasNombradas(t, x.registroVetos).map(r => `«${r.titulo}»`).join(', ')}, que choca con los disgustos del usuario y se retiró de los resultados. Rehaz la respuesta sin nombrarla, ni como candidata ni con aviso.`],
  ['guardadoReal', (t, x) => require('./asistente-evidencia').guardadoSinEvidencia(t, x),
    (t, x) => '[Aviso del sistema, no del usuario] Dices que has guardado una nota o pistas, pero no hay una llamada correcta a ' + require('./asistente-evidencia').guardadoSinEvidencia(t, x) + '. Guarda lo pedido con esa herramienta antes de afirmarlo; si falla, dilo.'],

  ['tarjetaViva', (t, x) => x.tarjetasQueRetirar.length
    && !(PIDE_TODAS.test(String(x.textoDelUsuario || '')) ? x.tarjetasQueRetirar.every(p => x.retiradas.includes(p.id)) : x.tarjetasQueRetirar.some(p => x.retiradas.includes(p.id))),
    (t, x) => c.CORRECCION_TARJETA_VIVA(x.tarjetasQueRetirar)],

  ['tarjeta', (t, x) => !x.pendientes.length && !x.hayTarjetaViva && prometeConfirmacion(t, { huboTarjeta: x.huboTarjeta }), () => CORRECCION_TARJETA],
  ['biblioteca', (t, x) => !x.point && !x.actions.length && c.diceLoQueTiene(t), () => c.CORRECCION_BIBLIOTECA],
  ['noGuarda', (t, x) => !x.point && !x.actions.length && c.niegaUnDato(t), () => c.CORRECCION_NO_GUARDA],
  ['comprobado', (t, x) => !x.point && !x.actions.length && !x.recuenta && c.afirmaHaberMirado(t), () => c.CORRECCION_COMPROBADO],
  ['hecho', (t, x) => !x.actions.length && !x.recuenta && c.afirmaHaberHecho(t), () => c.CORRECCION_HECHO],
  ['promesa', (t, x) => !x.actions.length && c.prometeCambio(t), () => c.CORRECCION_PROMESA],
  ['nuevos', (t, x) => c.diceSiHayNuevos(t, x.actions), () => c.CORRECCION_NUEVOS],
  ['cita', (t, x) => x.point && c.citaNumerada(t), () => c.CORRECCION_CITA],

  ['capitulo', (t, x) => x.guardado && !x.actions.some(a => /^(?:marcar_progreso|deshacer)$/.test(a.name)) && vaPorOtro(t, x.guardado),
    (t, x) => `[Aviso del sistema, no del usuario] Según lo guardado, va por el capítulo ${x.guardado}, y tu respuesta dice otro. Rehazla con ese número.` + PIE],

  ['campo', (t, x) => !PIDE_NOMBRES_INTERNOS.test(String(x.textoDelUsuario || '')) && c.ensenaUnCampo(t, c.camposDeLosResultados(x.messages)), () => c.CORRECCION_CAMPO],
  ['id', (t) => c.ensenaUnId(t), () => c.CORRECCION_ID],
  ['enlaces', (t, x) => enlacesInventados(t, x.messages).length, (t, x) => CORRECCION_ENLACES(enlacesInventados(t, x.messages))],
];

function avisoAntesDeResponder(texto, x) {
  const ctx = { actions: [], pendientes: [], retiradas: [], tarjetasQueRetirar: [], point: null, ...x };
  const dicho = String(ctx.textoDelUsuario || '');

  ctx.recuenta = Boolean(ctx.huboAcciones) && dicho.split(/(?<=[.!?\n;])/).some(f => ES_PREGUNTA.test(f.trim()) && PREGUNTA_POR_LO_HECHO.test(f));
  for (const [clave, salta, correccion] of REDES) {
    if (ctx.corregidas.has(clave) || !salta(texto, ctx)) continue;
    ctx.corregidas.add(clave);
    return correccion(texto, ctx) + PIE;
  }
  return null;
}

const DISCULPA = /^\s*¡?\s*(?:tienes (?:toda la )?raz[oó]n|perd[oó]n[ae]?|disculpa|lo siento|me (?:he )?equivocad[oa]|me equivoqu[eé]|me (?:he )?precipitad[oa]|me precipit[eé]|you'?re right|sorry)\b[^.!?:\n]*[.!?:]\s*/i;
function sinDisculpa(texto) {
  const resto = String(texto || '').replace(DISCULPA, '');
  if (!resto.trim() || resto === texto) return texto;
  return resto.charAt(0).toUpperCase() + resto.slice(1);
}

function vaPorOtro(texto, guardado) {

  return [...String(texto || '').matchAll(/\bvas\s+por\s+(?:el\s+)?\**\s*(?:cap[ií]tulo\s+)?\**\s*(\d+)/gi)].some(m => Number(m[1]) !== Number(guardado));
}

module.exports = { vaPorOtro, avisoAntesDeResponder, PREGUNTA_POR_LO_HECHO, PIE, cambioAlgo, sinDisculpa };
