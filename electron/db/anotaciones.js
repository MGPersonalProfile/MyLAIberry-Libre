const { leer, writeDB } = require('./nucleo.js');

function esFormaVieja(entrada) {
  return !!entrada && typeof entrada.texto === 'string';
}

async function getRecap(id, indice, idioma = 'original') {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  const delCapitulo = fanfic?.recaps?.[indice];
  if (!delCapitulo) return null;

  if (esFormaVieja(delCapitulo)) {
    return idioma === 'original' ? delCapitulo : null;
  }
  return delCapitulo[idioma] || null;
}

async function setRecap(id, indice, idioma, texto, origen, huella) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return;

  if (!fanfic.recaps) fanfic.recaps = {};

  const actual = fanfic.recaps[indice];
  if (esFormaVieja(actual)) fanfic.recaps[indice] = { original: actual };
  else if (!actual) fanfic.recaps[indice] = {};

  fanfic.recaps[indice][idioma] = { texto, origen, hechoEn: Date.now(), ...(huella ? { huella } : {}) };
  await writeDB();
}

async function getTitulosTraducidos(id, idioma) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  return fanfic?.titulosTraducidos?.[idioma] || null;
}

async function setTitulosTraducidos(id, idioma, titulos) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return;
  if (!fanfic.titulosTraducidos) fanfic.titulosTraducidos = {};
  fanfic.titulosTraducidos[idioma] = titulos;
  await writeDB();
}

async function getGlosario(id) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  return fanfic?.glosario || [];
}

async function glosarioParaTraducir(id) {
  const datos = await leer();
  const propio = datos.fanfics.find(f => String(f.id) === String(id))?.glosario || [];
  return require('../asistente-traduccion.js').glosarioConGenerales(propio, datos.assistant?.translationRules);
}

function quitadosTrasCambiar(antes, ahora, quitadosAntes) {
  const bajo = (t) => String(t).toLowerCase();
  const quedan = new Set(ahora.map(g => bajo(g.termino)));
  const quitados = new Set(quitadosAntes);
  for (const g of antes) if (!quedan.has(bajo(g.termino))) quitados.add(g.termino);
  for (const t of [...quitados]) if (quedan.has(bajo(t))) quitados.delete(t);
  return [...quitados];
}

async function setGlosario(id, glosario) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;

  fanfic.glosarioQuitados = quitadosTrasCambiar(fanfic.glosario || [], glosario, fanfic.glosarioQuitados || []);
  fanfic.glosario = glosario;
  await writeDB();
  return true;
}

async function marcarGlosarioResembrado(id) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (fanfic) {
    fanfic.glosarioResembrado = true;
    await writeDB();
  }
}

async function setOrigen(id, origen) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));

  if (require('../origen').cambiarOrigen(fanfic, origen)) {
    await writeDB();
    return true;
  }
  return false;
}

async function setSinopsisTraducida(id, idioma, texto) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => f.id === id || f.id === String(id));
  if (fanfic) {
    if (!fanfic.sinopsisTraducida) fanfic.sinopsisTraducida = {};
    fanfic.sinopsisTraducida[idioma] = texto;
    await writeDB();
  }
}

module.exports = {
  getRecap,
  setRecap,
  getTitulosTraducidos,
  setTitulosTraducidos,
  getGlosario,
  glosarioParaTraducir,
  setGlosario,
  quitadosTrasCambiar,
  marcarGlosarioResembrado,
  setSinopsisTraducida,
  setOrigen
};
