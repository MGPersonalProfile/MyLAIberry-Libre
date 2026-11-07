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

module.exports = { retiradasNombradas, sinNombrarRetiradas };
