const AFIRMA_HABER_MIRADO = /(?<!\b(?:no|nunca|todav[ií]a no|a[uú]n no)\s+(?:lo|la|los|las|le|les|te|me)?\s*)\b(?:he|hemos)\s+(?:revisado|mirado|comprobado|consultado|verificado|repasado|le[ií]do|buscado|echado un vistazo)\b|\bacabo de (?:revisar|mirar|comprobar|consultar|verificar|leer|buscar)\b|\bI(?:'ve| have)?\s+(?!not\b)(?:checked|looked|reviewed|verified|searched|read through)\b/i;

const DICE_QUE_TIENE = /\bno\s+(?:la|lo|las|los)\s+(?:veo|tengo|tienes|encuentro)\b[^.?!\n]{0,40}\bbiblioteca\b|\b(?:no\s+)?(?:est[aá]n?|aparecen?)\s+(?:cargad[oa]s?\s+)?en\s+tu\s+biblioteca\b|\bno\s+(?:la|lo)\s+veo\s+cargad[oa]\b|\btendr[ií]as\s+que\s+tener(?:la|lo)?\s+en\s+tu\s+biblioteca\b|(?<!\bsi\s+(?:ya\s+)?)\b(?:ya\s+)?(?:la|lo|las|los)\s+tienes\s+en\s+(?:tu\s+)?biblioteca\b/i;

const COLETILLA = /(?:,\s*)?(?:¿\s*(?:verdad|no|cierto|s[ií]|a que s[ií])\s*\?|\b(?:right|isn'?t it|don'?t you|aren'?t they)\s*\?)\s*$/i;
const CONDICION = /\b(?:si|cuando|en cuanto|en caso de que|if|when|whenever|once|quando|se(?=\s+(?:n[aã]o\s+)?(?:houver|h[aá]|tiver|existir|sair|for)(?![a-záéíóúãõç])))\s+[^,.;:!?\n]*?(?=\s+(?:pero|aunque|sino|but|although)\b|[,;:.!?\n]|$)[,;:]?/gi;
const soloAfirmaciones = (texto) => String(texto || '')
  .split(/(?<=[.!?\n])/).filter(frase => !COLETILLA.test(frase.trim())).join(' ')
  .replace(/¿[^?]*\?/g, ' ')
  .split(/(?<=[.!?\n])/).filter(frase => !/\?\s*$/.test(frase)).join(' ')
  .replace(CONDICION, ' ');
const afirmaHaberMirado = (texto) => AFIRMA_HABER_MIRADO.test(soloAfirmaciones(texto));

const CIFRA_DE_LO_QUE_TIENE = /\b(?:la|el|las|los)\s+(?:obras?\s+)?m[aá]s\s+(?:larga|corta|largo|corto|reciente|antigua|nueva|vieja|le[ií]da)s?\b[^.?!\n]{0,120}\b(?:es|son|ser[ií]a|tiene)\b|\btienes\s+\**\d+\**\s+obras\b/i;
const diceLoQueTiene = (texto) => DICE_QUE_TIENE.test(soloAfirmaciones(texto)) || CIFRA_DE_LO_QUE_TIENE.test(soloAfirmaciones(texto));

const NIEGA_UN_DATO = /\b(?:la app|la aplicaci[oó]n|mylaiberry)\s+no\s+(?:guarda|registra|apunta|almacena|lleva la cuenta|sabe)\b|\bno (?:tengo|hay) (?:esa|ese|esta|este|ning[uú]n[ao]?) (?:informaci[oó]n|dato|registro|historial|fecha)\b|\bthe app (?:doesn'?t|does not) (?:store|keep|track|record|save)\b|\bherramienta(?:\s+de\s+\w+)?\s+no\s+(?:me\s+)?(?:da|devuelve|trae|incluye|dice)\b/i;

const niegaUnDato = (texto) => NIEGA_UN_DATO.test(soloAfirmaciones(texto));
const CORRECCION_NO_GUARDA = '[Aviso del sistema, no del usuario] Tu respuesta dice que la app no guarda o no tiene un dato, pero en este turno ' +
  'no has mirado nada. La ficha de cada obra (biblioteca, con filtro para una) trae cuándo entró (anadida) y cuándo la abrió por última vez ' +
  '(ultimaLectura), además de por dónde va. Mira primero y contesta con lo que devuelva; si de verdad no está, entonces dilo.';

const CORRECCION_BIBLIOTECA = '[Aviso del sistema, no del usuario] Tu respuesta dice qué obras tiene o no tiene en su biblioteca, ' +
  'pero en este turno no la has mirado. Llama ahora a biblioteca (o a la herramienta de esa obra, que la busca por su título) ' +
  'y contesta con lo que devuelva.';

const CORRECCION_COMPROBADO = '[Aviso del sistema, no del usuario] Tu respuesta dice que has revisado o comprobado algo, ' +
  'pero en este turno no has llamado a ninguna herramienta, y los resultados de turnos anteriores ya no los tienes. ' +
  'Si hace falta mirarlo, llama ahora a la herramienta y contesta con lo que devuelva; si no, rehaz la respuesta sin ' +
  'afirmar que lo has comprobado y sin dar datos (títulos, números) que no estén en la conversación.';

const NO_ANTES = String.raw`(?<!\b(?:no|nunca|todav[ií]a no|a[uú]n no)\s+(?:lo|la|los|las|le|les|te|me|se)?\s*)`;
const AFIRMA_HABER_HECHO = new RegExp(
  String.raw`^\W*(?:listo|hecho|done|all set)\b|` +
  NO_ANTES + String.raw`\b(?:he|hemos)\s+(?:puesto|quitado|a[ñn]adido|subido|bajado|cambiado|guardado|borrado|eliminado|deshecho|activado|desactivado|encendido|apagado|creado|exportado|importado|marcado|traducido|apuntado|anotado|aplicado|metido|sacado|retirado|ajustado|dejado de seguir|dejado de vigilar)\b|` +

  String.raw`\b(?:ha|han)\s+(?:pasado|subido|bajado|quedado)\s+(?:de|a|en)\s+\S|\bqued[óo]\s+en\s+\d|\blo\s+deshago\b|` +
  String.raw`\bI(?:'ve| have)\s+(?!not\b)(?:added|removed|set|changed|saved|deleted|undone|enabled|disabled|created|exported|imported|marked|translated|turned)\b`,
  'i');

const MARCA_DE_LA_NOTA = /\[(?:Herramientas usadas en este turno|Nota del sistema)/i;

const afirmaHaberHecho = (texto) => AFIRMA_HABER_HECHO.test(soloAfirmaciones(texto).trim()) || MARCA_DE_LA_NOTA.test(String(texto || ''));

const CORRECCION_HECHO = '[Aviso del sistema, no del usuario] Tu respuesta da algo por hecho («listo», «he puesto»…), ' +
  'pero en este turno no has llamado a ninguna herramienta: no se ha hecho nada. Si el usuario lo pide ahora, llama a la ' +
  'herramienta y contesta con lo que devuelva; si lo hiciste en un turno anterior, dilo así, sin afirmarlo como nuevo. ' +
  'Nunca escribas notas entre corchetes como las del sistema.';

const CUENTA_UN_FALLO = /\b(?:no me deja|no funciona|no va\b|no pasa nada|no hace nada|no carga|no sale|no aparece|se queda (?:colgad|en blanco|pillad)|falla|da (?:un )?error|est[aá] roto|bug)/i;
const PIDE_QUE_SE_HAGA = /\b(?:hazlo|haz\s|pru[eé]ba(?:lo|la)?|a[ñn][aá]de(?:lo|la|los|las)|gu[aá]rda(?:lo|la)|m[eé]te(?:lo|la)|p[oó]n(?:lo|la)|arr[eé]gla(?:lo|la)?|int[eé]nta(?:lo|la)|vuelve a|t[uú] mism[oa]|do it|add it|try it)\b/i;
const soloCuentaUnFallo = (t) => CUENTA_UN_FALLO.test(String(t || '')) && !PIDE_QUE_SE_HAGA.test(String(t || ''));
const SOLO_CONTO_UN_FALLO = { hecho: false, aviso: 'No se ha hecho: el usuario ha contado un fallo, no ha pedido que lo hagas. No toques su biblioteca para probar; pregúntale si quiere que lo hagas tú, sin contarle este aviso ni disculparte por él.' };

const PROMETE_CAMBIO = /\b(?:a partir de ahora|de (?:ahora|hoy) en adelante|desde (?:ahora|hoy)|from now on)\b|(?:^|[.!?;:]\s+)en adelante\b|\bya no (?:te )?(?:buscar[eé]|avisar[eé]|investigar[eé]|vigilar[eé]|recomendar[eé]|propondr[eé]|har[eé]|traducir[eé]|sugerir[eé])(?![a-záéíóúñ])|\bno (?:te )?volver[eé] a\b|\bI (?:won'?t|will not) (?:search|suggest|recommend|notify|translate)\b/i;
const prometeCambio = (texto) => PROMETE_CAMBIO.test(soloAfirmaciones(texto));
const CORRECCION_PROMESA = '[Aviso del sistema, no del usuario] Tu respuesta promete cambiar cómo vas a funcionar («a partir de ahora», ' +
  '«ya no buscaré»…), pero en este turno no has llamado a nada y no se ha guardado: al próximo turno no lo recordarás. Si hay ' +
  'herramienta para ello (ajustar_asistente, ajustar_lector, recordar_gusto, regla_traduccion…), llámala; si no, dile que no puedes.';

const CITA_NUMERADA = /\[(?!\d+:\d+:\d+(?:-\d+)?\])(?:\d[\d\s:,\-–.…]*|(?:resumen|cap[ií]tulo|cap\.?|ref|fuente|p[aá]rrafo)\b[^\]\n]{0,40})\]/i;

const ENCABEZADO = /^\s*(?:#+\s*\[(?=[^\]\n]*\p{L})[^\]\n]{1,40}\]|(?:\*\*|__)\[(?=[^\]\n]*\p{L})[^\]\n]{1,40}\](?:\*\*|__)|\[(?=[^\]\n]*\p{L})[^\]\n]{1,40}\]\s*$)/gmu;
const citaNumerada = (texto) => CITA_NUMERADA.test(String(texto || '').replace(ENCABEZADO, ''));
const CORRECCION_CITA = '[Aviso del sistema, no del usuario] Tu respuesta cita con números entre corchetes («[1]»). ' +
  'Sólo se cita con el ref de un pasaje suministrado, entre corchetes; lo que viene de buscar_en_la_obra o resumen_de_capitulo ' +
  'se dice «en el capítulo N», sin corchetes. Rehaz la respuesta.';

const ID_A_LA_VISTA = /(?<![\[\d])\b\d{13}\b/;
const ensenaUnId = (texto) => ID_A_LA_VISTA.test(String(texto || ''));
const CORRECCION_ID = '[Aviso del sistema, no del usuario] Tu respuesta enseña un id de trece cifras: el usuario no los ve en ' +
  'ningún sitio. Rehazla nombrando las obras por lo que sí ve (título, autor, sitio, capítulos, cuándo se añadió). ' +
  'Si es la cita de un pasaje, va entera entre corchetes, [obra:capítulo:párrafo], sin «ref» delante.';

const DICE_SI_HAY_NUEVOS = /\bno\s+hay\s+(?:ning[uú]n\s+)?(?:cap[ií]tulos?\s+nuevos?|novedades)|\bsin\s+(?:cap[ií]tulos\s+nuevos|novedades)\b|\bno\s+ha\s+(?:publicado|subido|sacado)\s+nada\b|\bhay\s+\d+\s+cap[ií]tulos?\s+nuevos?\b|\bno new chapters\b|\bn[aã]o\s+h[aá]\s+(?:nenhum\s+)?cap[ií]tulos?\s+novos?\b|\bsem\s+cap[ií]tulos\s+novos\b/i;
const MIRO_SI_HAY_NUEVOS = (actions) => actions.some(a => a.ok && /^buscar_capitulos_nuevos/.test(a.name));
const diceSiHayNuevos = (texto, actions = []) => DICE_SI_HAY_NUEVOS.test(soloAfirmaciones(texto)) && !MIRO_SI_HAY_NUEVOS(actions);
const CORRECCION_NUEVOS = '[Aviso del sistema, no del usuario] Tu respuesta dice si hay capítulos nuevos, pero en este turno ' +
  'no has llamado a buscar_capitulos_nuevos: la biblioteca sólo sabe lo ya descargado, no lo publicado. Llámala ahora (si la obra es ' +
  'ambigua, pregunta cuál) o rehaz la respuesta sin afirmarlo.';

function completarCitas(texto, context) {
  if (!context?.point || !texto) return texto;
  const w = context.point.workId;
  const refs = new Set((context.blocks || []).map(b => b.ref));
  return String(texto).replace(/\[(\d+):(\d+)(?:[-–](\d+))?\]/g,
    (todo, c, p, hasta) => refs.has(`${w}:${c}:${p}`) ? `[${w}:${c}:${p}${hasta ? '-' + hasta : ''}]` : todo);
}

const SE_ARREPIENTE = /\b(?:d[eé]ja(?:l[oa]s?|lo\s+estar|lo\s+as[ií])|mejor\s+no|no\s+(?:la|lo|las|los)\s+(?:borres|toques|quites|hagas|enciendas)|canc[eé]la(?:lo|la)?|olv[ií]da(?:lo|la)|no\s+hace\s+falta|al\s+final\s+no|me\s+arrepiento|espera,?\s+no)\b/i;
const seArrepiente = (texto) => SE_ARREPIENTE.test(String(texto || ''));
const CORRECCION_TARJETA_VIVA = (tarjetas) => '[Aviso del sistema, no del usuario] En esta conversación hay tarjetas esperando a que el usuario pulse «Hacerlo»: ' +
  tarjetas.map(t => `«${t.resumen}» (id «${t.id}»)`).join('; ') + '. Su mensaje parece echarse atrás. Si es eso, retira con deshacer y su id la que rechaza ' +
  '(si nombra una obra, la de esa obra; si no queda claro cuál, pregúntaselo) para que no se pueda pulsar; si quería otra cosa, contesta sin decir que no se hará.';

let campos = null;
const CAMPOS = () => campos || (campos = (() => {
  const ficha = Object.keys(require('./asistente-obra').fichaDeObra({ title: 'x', currentChapter: 1, totalChapters: 2, lastReadAt: 1, addedAt: 1, url: 'x', tags: [] }));
  const internos = [...new Set([...ficha, ...require('./asistente-ajustes').CLAVES_DE_AJUSTE])].filter(k => /[a-z][A-Z]/.test(k));
  const herramientas = [...require('./asistente-app').CATALOGO.map(e => e.nombre),
    ...require('./asistente-tools').crearTools({ state: { read: async () => ({}) }, services: {} }).specs.map(s => s.function?.name || s.name), 'deshacer']
    .filter(n => /_/.test(n));
  return [...internos, ...new Set(herramientas)];
})());

const ensenaUnCampo = (texto, deLosResultados = []) => [...CAMPOS(), ...deLosResultados]
  .some(k => new RegExp(`\\b[${k[0]}${k[0].toUpperCase()}]${k.slice(1)}\\b`).test(String(texto || '')))

  || [...String(texto || '').matchAll(/`(\w+)`|\b(\w+)\s*[:=]\s*["'`]/g)].some(m => require('./asistente-ajustes').CLAVES_DE_AJUSTE.includes(m[1] || m[2]));

const camposDeLosResultados = (messages = []) => [...new Set(messages.filter(m => m.role === 'tool')
  .flatMap(m => [...String(m.content || '').matchAll(/"([a-z]+[A-Z][A-Za-z]*|[a-z]+(?:_[a-z]+){2,})":/g)].map(x => x[1])))];
const CORRECCION_CAMPO = '[Aviso del sistema, no del usuario] Tu respuesta enseña nombres internos de campos, ajustes o herramientas ' +
  '(como capitulosPorLeer, fontSize o cambiar_estanteria): el usuario no los ve en ningún sitio. Rehazla diciéndolo con palabras («te faltan 13 capítulos por leer», «el tamaño de la letra», «puedo quitar obras de la estantería»).';

module.exports = { niegaUnDato, CORRECCION_NO_GUARDA, camposDeLosResultados, ensenaUnCampo, CORRECCION_CAMPO, seArrepiente, CORRECCION_TARJETA_VIVA, diceLoQueTiene, CORRECCION_BIBLIOTECA, completarCitas, diceSiHayNuevos, CORRECCION_NUEVOS, afirmaHaberMirado, CORRECCION_COMPROBADO, afirmaHaberHecho, CORRECCION_HECHO, soloCuentaUnFallo, SOLO_CONTO_UN_FALLO, ensenaUnId, CORRECCION_ID, prometeCambio, CORRECCION_PROMESA, citaNumerada, CORRECCION_CITA };
