const { leer, writeDB } = require('./nucleo');
const { esDeLaBiblioteca } = require('../origen.js');
const { fandomsDe, claveAutor, coincideFandom, normal, oculta } = require('../descubrimientos-preferencias');

async function getPreferenciasDescubrimientos() {
  const d = await leer();
  const preferencias = d.preferenciasDescubrimientos || { autores: [], fandoms: [], aprender: true };
  const candidatas = d.fanfics.filter(o => o.origen === 'descubierta');
  const fandoms = new Map(), autores = new Map();
  for (const o of candidatas) {
    for (const f of fandomsDe(o)) fandoms.set(f, (fandoms.get(f) || 0) + 1);
    if (normal(o.author)) {
      const k = claveAutor(o), a = autores.get(k) || { clave: k, nombre: o.author, fuente: o.source, cuantas: 0 };
      a.cuantas++; autores.set(k, a);
    }
  }
  const ocultas = candidatas.filter(o => oculta(o, preferencias)).length;

  const por = (p) => candidatas.filter(o => oculta(o, { ...p })).length;
  const ocultasPor = { formato: por({ formato: preferencias.formato }), autores: por({ autores: preferencias.autores }), fandoms: por({ fandoms: preferencias.fandoms }) };
  return { preferencias, totalVisibles: candidatas.length - ocultas, totalOcultas: ocultas, ocultasPor,
    fandoms: [...fandoms].sort((a, b) => b[1] - a[1]), autores: [...autores.values()].sort((a, b) => b.cuantas - a.cuantas) };
}

const textoCorto = (v, que) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== 'string' || v.length > 300) throw new Error(`${que} no válido.`);
  return v;
};

function claveDe(d, autor) {
  if (!autor || d.fanfics.some(f => claveAutor(f) === autor) || d.preferenciasDescubrimientos?.autores?.some(a => a.clave === autor)) return autor;
  const claves = new Set(d.fanfics.filter(f => normal(f.author) && normal(f.author) === normal(autor)).map(claveAutor));
  if (claves.size > 1) throw new Error('Hay varios autores con ese nombre: usa su clave de preferencias_descubrimientos.');
  return claves.size ? [...claves][0] : autor;
}

const cifra = (v, que) => {
  if (v === undefined || v === null) return 0;
  if (!Number.isInteger(v) || v < 0 || v > 5000000) throw new Error(`${que} no válido.`);
  return v;
};

async function decidirDescubrimientos({ accion, fandom, autor, aprender, minPalabras, minCapitulos, romance } = {}) {
  fandom = textoCorto(fandom, 'Fandom'); autor = textoCorto(autor, 'Autor');
  const d = await leer();
  autor = claveDe(d, autor);
  const p = d.preferenciasDescubrimientos ||= { autores: [], fandoms: [], aprender: true };
  let descartadas = 0;
  if (accion === 'aprender' && typeof aprender === 'boolean') p.aprender = aprender;

  else if (accion === 'formato') {
    if (romance !== undefined && !['', 'hundir', 'ocultar'].includes(romance)) throw new Error('Romance: «hundir», «ocultar» o vacío.');
    const antes = p.formato || {};
    p.formato = {
      minPalabras: minPalabras === undefined ? antes.minPalabras || 0 : cifra(minPalabras, 'Mínimo de palabras'),
      minCapitulos: minCapitulos === undefined ? antes.minCapitulos || 0 : cifra(minCapitulos, 'Mínimo de capítulos'),
      ...((romance === undefined ? antes.romance : romance) ? { romance: romance === undefined ? antes.romance : romance } : {})
    };
  }
  else if (accion === 'desbloquearAutor') p.autores = p.autores.filter(a => a.clave !== autor);
  else if (accion === 'mostrarFandom') p.fandoms = p.fandoms.filter(f => normal(f) !== normal(fandom));
  else if (accion === 'bloquearAutor') {
    const o = d.fanfics.find(f => claveAutor(f) === autor && normal(f.author));
    if (!o) throw new Error('Elige un autor de los descubrimientos.');
    if (!p.autores.some(a => a.clave === autor)) p.autores.push({ clave: autor, nombre: o.author, fuente: o.source });
  } else if (accion === 'descartarFandom' || accion === 'ocultarFandom') {
    if (!normal(fandom) || !d.fanfics.some(o => coincideFandom(o, fandom))) throw new Error('Elige un fandom de la lista.');
    if (accion === 'ocultarFandom' && !p.fandoms.some(f => normal(f) === normal(fandom))) p.fandoms.push(fandom);
    if (accion === 'descartarFandom') for (const o of d.fanfics) {
      if (o.origen !== 'descubierta' || !coincideFandom(o, fandom)) continue;
      o.origen = 'descartada'; o.descarteMasivo = true; descartadas++;
    }
  } else throw new Error('Acción de descubrimientos inválida.');
  await writeDB();
  return { status: 'ok', descartadas, ocultas: d.fanfics.filter(o => o.origen === 'descubierta' && oculta(o, p)).length, preferencias: p };
}

async function descartarObra(id) {
  const d = await leer();
  const o = d.fanfics.find(f => String(f.id) === String(id));

  const entroSola = esDeLaBiblioteca(o) && Date.now() - (o?.propuesta?.adoptadaAlVencer || 0) < 60 * 60 * 1000;
  if (!o || (o.origen !== 'descubierta' && !entroSola)) throw new Error('Sólo se descartan obras de Descubrimientos.');
  o.origen = 'descartada';
  o.descartadaEn = Date.now();
  delete o.descarteMasivo;
  await writeDB();
  return { status: 'ok' };
}

async function deshacerDescarte(id) {
  const d = await leer();
  const o = d.fanfics.find(f => String(f.id) === String(id));
  if (!o || o.origen !== 'descartada') throw new Error('Sólo se recuperan obras descartadas.');
  const limiteMs = 7 * 24 * 60 * 60 * 1000;
  if (o.descartadaEn && Date.now() - o.descartadaEn > limiteMs) {
    throw new Error('El plazo de 7 días para recuperar este descarte ha vencido.');
  }
  o.origen = 'descubierta';
  if (o.propuesta) {
    if (o.propuesta.vence && o.propuesta.vence <= Date.now()) {
      const horas = Number(o.propuesta.horas) || 72;
      o.propuesta.vence = Date.now() + horas * 3600 * 1000;
    }
    delete o.propuesta.adoptadaAlVencer;
  }
  delete o.descartadaEn;
  delete o.descarteMasivo;
  await writeDB();
  return { status: 'ok', obra: o };
}

async function descartesRecientes(ahora = Date.now(), limiteDias = 7) {
  const d = await leer();
  const maxMs = limiteDias * 24 * 60 * 60 * 1000;
  return (d.fanfics || [])
    .filter(o => o.origen === 'descartada' && Number.isFinite(o.descartadaEn) && ahora - o.descartadaEn <= maxMs && !o.descarteMasivo)
    .sort((a, b) => (b.descartadaEn || 0) - (a.descartadaEn || 0))
    .map(o => ({
      id: String(o.id),
      title: o.title,
      author: o.author,
      source: o.source,
      descartadaEn: o.descartadaEn || null,
      propuesta: o.propuesta || null
    }));
}

async function marcarPropuesta(id, propuesta) {
  const d = await leer();
  const o = d.fanfics.find(f => String(f.id) === String(id));

  const quitaMarca = propuesta?.adoptadaAlVencer === null;
  if (!o || (o.origen !== 'descubierta' && !quitaMarca)) return null;
  o.propuesta = { ...(o.propuesta || {}), ...propuesta };
  await writeDB();
  return o;
}

const ADOPCION_CORTADA_MS = 30 * 60 * 1000;
async function propuestasVencidas(ahora = Date.now()) {
  const d = await leer();
  const pendiente = p => !p.adoptadaAlVencer || ahora - p.adoptadaAlVencer > ADOPCION_CORTADA_MS;
  return d.fanfics.filter(o => o.origen === 'descubierta' && o.propuesta?.vence && o.propuesta.vence <= ahora && pendiente(o.propuesta))
    .map(o => ({ id: String(o.id), title: o.title }));
}

module.exports = {
  getPreferenciasDescubrimientos,
  decidirDescubrimientos,
  descartarObra,
  deshacerDescarte,
  descartesRecientes,
  marcarPropuesta,
  propuestasVencidas
};
