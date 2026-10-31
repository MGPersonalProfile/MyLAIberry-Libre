const { leer, writeDB } = require('./nucleo.js');

const AUTOMATICOS = new Set(['modelo', 'propagado']);

async function setGenerosCrudos(id, crudas) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;
  fanfic.generosCrudos = crudas;
  await writeDB();
  return true;
}

function aplicarDecision(fanfic, seguros = [], propuestos = []) {
  const fuera = new Set((fanfic.generosDescartados || []).map(g => g.toLowerCase()));
  const otras = (fanfic.tags || []).filter(t => t.category !== 'genre' || !AUTOMATICOS.has(t.origen));
  const yaEstan = new Set(
    otras.filter(t => t.category === 'genre').map(t => String(t.name).toLowerCase())
  );
  const admite = (g) => !fuera.has(g.nombre.toLowerCase()) && !yaEstan.has(g.nombre.toLowerCase());

  fanfic.tags = [
    ...otras,
    ...seguros.filter(admite).map(g => ({ name: g.nombre, category: 'genre', origen: 'modelo' }))
  ];
  fanfic.generosPropuestos = propuestos.filter(admite).map(g => ({ nombre: g.nombre, z: g.z }));
}

async function setGenerosDecididosEnLote(decisiones = []) {
  if (decisiones.length === 0) return 0;

  const datos = await leer();
  const porId = new Map(datos.fanfics.map(f => [String(f.id), f]));

  let tocadas = 0;
  for (const { id, seguros, propuestos } of decisiones) {
    const fanfic = porId.get(String(id));
    if (!fanfic) continue;
    aplicarDecision(fanfic, seguros, propuestos);
    tocadas++;
  }

  if (tocadas > 0) await writeDB();
  return tocadas;
}

async function proponerGenero(id, nombre, motivo = []) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;

  const bajo = String(nombre).toLowerCase();
  if ((fanfic.generosDescartados || []).some(g => g.toLowerCase() === bajo)) return false;
  if ((fanfic.tags || []).some(t => t.category === 'genre' && String(t.name).toLowerCase() === bajo)) return false;

  if (!Array.isArray(fanfic.generosPropuestos)) fanfic.generosPropuestos = [];
  if (fanfic.generosPropuestos.some(g => g.nombre.toLowerCase() === bajo)) return false;

  fanfic.generosPropuestos.push({ nombre, origen: 'propagado', porque: motivo });
  await writeDB();
  return true;
}

async function confirmarGenero(id, nombre) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;

  const ya = (fanfic.tags || []).some(
    t => t.category === 'genre' && String(t.name).toLowerCase() === String(nombre).toLowerCase()
  );
  if (!ya) {
    fanfic.tags = [...(fanfic.tags || []), { name: nombre, category: 'genre', origen: 'usuario' }];
  }
  fanfic.generosPropuestos = (fanfic.generosPropuestos || [])
    .filter(g => g.nombre.toLowerCase() !== String(nombre).toLowerCase());

  await writeDB();
  return true;
}

async function descartarGenero(id, nombre) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;

  const bajo = String(nombre).toLowerCase();
  if (!Array.isArray(fanfic.generosDescartados)) fanfic.generosDescartados = [];
  if (!fanfic.generosDescartados.some(g => g.toLowerCase() === bajo)) {
    fanfic.generosDescartados.push(nombre);
  }

  fanfic.generosPropuestos = (fanfic.generosPropuestos || [])
    .filter(g => g.nombre.toLowerCase() !== bajo);
  fanfic.tags = (fanfic.tags || []).filter(
    t => !(t.category === 'genre' && AUTOMATICOS.has(t.origen) && String(t.name).toLowerCase() === bajo)
  );

  await writeDB();
  return true;
}

async function setEnMiLista(id, dentro) {
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;
  fanfic.enMiLista = dentro ? Date.now() : null;
  await writeDB();
  return true;
}

const ESTADOS_DE_LECTURA = ['en pausa', 'abandonada', 'leída fuera'];
async function setEstadoLectura(id, pedido) {

  const plano = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const estado = pedido == null ? null : ESTADOS_DE_LECTURA.find(e => plano(e) === plano(pedido));
  if (pedido != null && !estado) throw new Error('Estado de lectura no válido.');
  const datos = await leer();
  const fanfic = datos.fanfics.find(f => String(f.id) === String(id));
  if (!fanfic) return false;
  fanfic.estadoLectura = estado || null;
  fanfic.estadoLecturaDesde = estado ? Date.now() : null;
  await writeDB();
  return true;
}

module.exports = {
  ESTADOS_DE_LECTURA,
  setEstadoLectura,
  setGenerosCrudos,
  setGenerosDecididosEnLote,
  proponerGenero,
  confirmarGenero,
  descartarGenero,
  setEnMiLista
};
