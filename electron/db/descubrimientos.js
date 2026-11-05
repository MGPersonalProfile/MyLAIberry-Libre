const { leer, writeDB } = require('./nucleo');
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
  if (!o || o.origen !== 'descubierta') throw new Error('Sólo se descartan obras de Descubrimientos.');
  o.origen = 'descartada';
  delete o.descarteMasivo;
  await writeDB();
  return { status: 'ok' };
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

async function propuestasVencidas(ahora = Date.now()) {
  const d = await leer();
  return d.fanfics.filter(o => o.origen === 'descubierta' && o.propuesta?.vence && o.propuesta.vence <= ahora && !o.propuesta.adoptadaAlVencer)
    .map(o => ({ id: String(o.id), title: o.title }));
}

module.exports = { getPreferenciasDescubrimientos, decidirDescubrimientos, descartarObra, marcarPropuesta, propuestasVencidas };
