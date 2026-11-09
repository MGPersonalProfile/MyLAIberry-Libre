const { esObra } = require('./asistente-vetos');
const { NIVELES_EVIDENCIA, evaluarEvidencia } = require('./asistente-premisa');
const { afirmacionesSinEvidencia, rechazarVerificacionSinEvidencia } = require('./asistente-afirmaciones');

const AVISO = 'No hay sinopsis disponible: dilo así. No la inventes ni la deduzcas del título, las etiquetas o el fandom; ofrece abrir su ficha.';

function marcarSinSinopsis(v) {
  if (Array.isArray(v)) return v.map(marcarSinSinopsis);
  if (!v || typeof v !== 'object') return v;
  if (/^Tu biblioteca/.test(String(v.fuente || ''))) return v;
  const hijos = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, marcarSinSinopsis(x)]));
  return esObra(v) && !String(v.synopsis ?? '').trim() ? { ...hijos, sinSinopsis: AVISO } : hijos;
}

module.exports = {
  marcarSinSinopsis,
  AVISO,
  NIVELES_EVIDENCIA,
  evaluarEvidencia,
  afirmacionesSinEvidencia,
  rechazarVerificacionSinEvidencia
};
