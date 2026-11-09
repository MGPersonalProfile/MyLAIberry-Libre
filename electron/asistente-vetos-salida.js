const { claveDeObra } = require('./misma-obra');
const { sinAcentos } = require('./asistente-vetos-parejas');

const plano = (s) => ` ${sinAcentos(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nombra(texto, r, soloUrl = false) {
  const clave = claveDeObra(r.url);
  if (clave && new RegExp(`${escapar(clave)}(?!\\d)`, 'i').test(String(texto))) return true;
  if (soloUrl) return false;
  const t = plano(texto);
  const titulo = plano(r.titulo);
  const nombre = String(r.titulo || '').trim();
  if (!nombre) return false;
  if (!t.includes(titulo)) return false;
  const citado = new RegExp(`[«"“*]\\s*${escapar(nombre)}\\s*[»"”*]`, 'i').test(String(texto));
  const enumerado = new RegExp(`^\\s*(?:[-*]|\\d+[.)])\\s*(?:\\*\\*)?${escapar(nombre)}(?:\\s|[:—-]|$)`, 'im').test(String(texto));
  const corte = String(texto).split(new RegExp(`(?<![\\p{L}\\p{N}])${escapar(nombre)}(?![\\p{L}\\p{N}])`, 'iu'))[0];
  const recomendado = /\b(?:recomiendo|recomienda|prueba|lee|descarto|descarta|obra|fic|fanfics?)\s*(?:a|el|la|[«"“*])*\s*$/i.test(corte);
  return citado || enumerado || recomendado;
}

function retiradasNombradas(texto, registro) {
  if (!registro?.retiradas.length || !texto) return [];
  return registro.retiradas.filter(r => !registro.esPermitida(r) && nombra(String(texto), r, registro.tieneHomonimaPermitida?.(r)));
}

function sinNombrarRetiradas(texto, registro) {
  const nombradas = retiradasNombradas(texto, registro);
  if (!nombradas.length) return texto;
  const quedan = String(texto).split(/\n/).flatMap(linea => linea.split(/(?<=;)\s*/))
    .filter(segmento => !nombradas.some(r => nombra(segmento, r, registro.tieneHomonimaPermitida?.(r))));
  const resto = quedan.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return resto
    ? `${resto}\n\n(Quité de la respuesta lo que chocaba con tus disgustos.)`
    : 'Lo que encontré choca con tus disgustos, así que no te recomiendo nada de ello.';
}

const COMPATIBLE = /\b(?:compatibles?|no\s+choca|encaja(?:n)?\s+con\s+tus|apta|sin\s+(?:slash|m\/m)|no\s+es\s+(?:slash|m\/m)|libre\s+de\s+(?:slash|m\/m))\b/i;

const CAUTELA = /sin\s+comprobar|sin\s+verificar|no\s+(?:he\s+podido|puedo|pude)\s+(?:comprobar|verificar|confirmar)|no\s+(?:est[aá]|esta)\s+(?:comprobad|verificad)|no\s+comprobad|no\s+verificad|pendiente|por\s+comprobar|falta\s+(?:abrir|comprobar)|antes\s+de\s+recomend|no\s+(?:te\s+)?la\s+(?:doy|recomiendo)|no\s+s[eé]\s+si|puede\s+(?:que\s+)?chocar|datos\s+insuficientes|no\s+clasificad|sin\s+clasificar/i;

const segmentos = (texto) => String(texto).split(/\n/).flatMap(linea => linea.split(/(?<=[.;!?])\s+(?=\S)/));

const pedidaPorElUsuario = (r, textoDelUsuario) => !!textoDelUsuario && nombra(String(textoDelUsuario), r);

function ofrecidaComoBuena(seg, r, textoDelUsuario) {
  if (!nombra(seg, r)) return false;

  const dicho = String(r.titulo || '') ? seg.split(new RegExp(escapar(String(r.titulo)), 'i')).join(' ') : seg;
  if (CAUTELA.test(dicho)) return false;
  return COMPATIBLE.test(dicho) || (r.estado !== 'pendiente_verificacion' && !pedidaPorElUsuario(r, textoDelUsuario));
}

function pendientesPresentadasComoBuenas(texto, registro, textoDelUsuario = '') {
  if (!registro?.noVerificadas?.length || !texto) return [];
  return registro.noVerificadas.filter(r => !registro.verificada?.(r) && segmentos(texto).some(seg => ofrecidaComoBuena(seg, r, textoDelUsuario)));
}

const ETIQUETA_DEL_ESTADO = { relacion_no_clasificada: 'lleva una relación que no se puede clasificar', datos_insuficientes: 'no publica datos suficientes',
  pendiente_verificacion: 'está pendiente de abrir su ficha completa' };

function sinRecomendarPendientes(texto, registro, textoDelUsuario = '') {
  const malas = pendientesPresentadasComoBuenas(texto, registro, textoDelUsuario);
  if (!malas.length) return texto;
  const dicho = new Set();
  const nuevo = String(texto).split(/\n/).map(linea => segmentos(linea).map(seg => {
    const r = malas.find(x => ofrecidaComoBuena(seg, x, textoDelUsuario));
    if (!r) return seg;
    if (dicho.has(r.url || r.titulo)) return '';
    dicho.add(r.url || r.titulo);
    return `«${r.titulo}»: aún no he podido comprobar si choca con tus disgustos (${ETIQUETA_DEL_ESTADO[r.estado] || 'sin comprobar'}); no te la doy por compatible, y puedo abrir su ficha para comprobarla.`;
  }).filter(Boolean).join(' ')).join('\n');
  return nuevo.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { retiradasNombradas, sinNombrarRetiradas, pendientesPresentadasComoBuenas, sinRecomendarPendientes };
