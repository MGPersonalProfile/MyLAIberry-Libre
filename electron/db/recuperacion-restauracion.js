const fs = require('fs/promises');
const path = require('path');
const { escribirEntero } = require('../escritura-entera.js');

const ID_DE_OBRA = /^[A-Za-z0-9_-]{1,64}$/;
const CARPETA_COPIAS = 'copias';
const FICHERO_ULTIMO = 'recuperacion-ultima.json';
const BASE_DATOS = 'mylaiberry-db.json';

function validarIdObra(id) {
  const limpio = String(id ?? '');
  if (!ID_DE_OBRA.test(limpio) || limpio.includes('..') || path.basename(limpio) !== limpio) {
    throw new Error(`Identificador de obra no valido: ${JSON.stringify(limpio).slice(0, 60)}`);
  }
  return limpio;
}

function generarIdRestauracion() {
  return `recup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function inventariarRestauracion(raiz, actual, restaurada, opciones = {}) {
  const fanficsActuales = Array.isArray(actual?.fanfics) ? actual.fanfics : [];
  const idsRestaurados = new Set((restaurada?.fanfics || []).map(f => f.id));
  const obrasExcluidas = [];

  for (const f of fanficsActuales) {
    if (!idsRestaurados.has(f.id)) {
      const idLimpio = validarIdObra(f.id);
      const rutaCarpeta = path.join(raiz, 'fanfics', idLimpio);
      const existeCarpeta = await fs.stat(rutaCarpeta).then(() => true).catch(() => false);
      obrasExcluidas.push({
        id: idLimpio,
        title: f.title || f.titulo || idLimpio,
        carpetaExiste: existeCarpeta,
        recuperada: false,
        datos: f
      });
    }
  }

  const { trabajosExcluidos, terminados } = clasificarTrabajos(actual?.trabajos || [], restaurada?.trabajos || []);

  return {
    id: opciones.id || generarIdRestauracion(),
    fecha: new Date().toISOString(),
    origen: opciones.origen || null,
    antesDeRestaurar: opciones.antesDeRestaurar || null,
    obrasExcluidas,
    trabajosExcluidos,
    trabajosTerminadosPosteriores: terminados
  };
}

function clasificarTrabajos(trabajosActuales, trabajosRestaurados) {
  const idsRestaurados = new Set(trabajosRestaurados.map(t => t.id));
  const trabajosExcluidos = [];
  const terminados = [];

  for (const t of trabajosActuales) {
    const estaTerminado = t.terminado === true || t.estado === 'terminado' || !!t.terminadaEn;
    if (estaTerminado) {
      terminados.push(t);
    } else if (!idsRestaurados.has(t.id)) {
      trabajosExcluidos.push({ ...t, recuperado: false });
    }
  }

  return { trabajosExcluidos, terminados };
}

async function guardarInventario(raiz, inventario, { fsOverride } = {}) {
  const dirCopias = path.join(raiz, CARPETA_COPIAS);
  await (fsOverride || fs).mkdir(dirCopias, { recursive: true });

  const texto = JSON.stringify(inventario, null, 2);
  const rutaFichero = path.join(dirCopias, `recuperacion-${inventario.id}.json`);
  const rutaUltimo = path.join(dirCopias, FICHERO_ULTIMO);

  if (fsOverride?.writeFile) {
    await fsOverride.writeFile(rutaFichero, texto);
    await fsOverride.writeFile(rutaUltimo, texto);
  } else {
    await escribirEntero(rutaFichero, texto);
    await escribirEntero(rutaUltimo, texto);
  }
}

async function leerBase(raiz) {
  const rutaBase = path.join(raiz, BASE_DATOS);
  const texto = await fs.readFile(rutaBase, 'utf-8').catch(() => null);
  if (!texto) return { fanfics: [], trabajos: [] };
  try { return JSON.parse(texto); } catch { return { fanfics: [], trabajos: [] }; }
}

async function listarRecuperables(raiz) {
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const texto = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!texto) return { id: null, obras: [], trabajos: [] };

  try {
    const inv = JSON.parse(texto);
    const db = await leerBase(raiz);
    const idsEnDb = new Set((db.fanfics || []).map(f => f.id));
    const idsTrabajos = new Set((db.trabajos || []).map(t => t.id));

    const obras = (inv.obrasExcluidas || []).map(o => ({
      ...o,
      recuperada: o.recuperada || idsEnDb.has(o.id)
    }));
    const trabajos = (inv.trabajosExcluidos || []).map(t => ({
      ...t,
      recuperado: t.recuperado || idsTrabajos.has(t.id)
    }));

    return { id: inv.id, fecha: inv.fecha, obras, trabajos };
  } catch {
    return { id: null, obras: [], trabajos: [] };
  }
}

async function recuperarObra(raiz, id) {
  const idLimpio = validarIdObra(id);
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const textoInv = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!textoInv) throw new Error('No hay inventario de recuperación disponible.');

  const inv = JSON.parse(textoInv);
  const item = (inv.obrasExcluidas || []).find(o => o.id === idLimpio);
  if (!item) throw new Error(`Obra no encontrada en el inventario de recuperación: ${idLimpio}`);

  const db = await leerBase(raiz);
  if (!Array.isArray(db.fanfics)) db.fanfics = [];

  const yaExiste = db.fanfics.some(f => f.id === idLimpio);
  if (!yaExiste) {
    db.fanfics.push(item.datos || { id: idLimpio, title: item.title });
    await escribirEntero(path.join(raiz, BASE_DATOS), JSON.stringify(db, null, 2));
  }

  item.recuperada = true;
  await guardarInventario(raiz, inv);
  return { ok: true, obra: item.datos || { id: idLimpio, title: item.title } };
}

async function recuperarTrabajos(raiz, seleccion = []) {
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const textoInv = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!textoInv) throw new Error('No hay inventario de recuperación disponible.');

  const inv = JSON.parse(textoInv);
  const db = await leerBase(raiz);
  if (!Array.isArray(db.trabajos)) db.trabajos = [];

  const elegidos = new Set(seleccion);
  const anadidos = [];

  for (const t of (inv.trabajosExcluidos || [])) {
    if (elegidos.has(t.id) && !db.trabajos.some(existente => existente.id === t.id)) {
      db.trabajos.push(t);
      t.recuperado = true;
      anadidos.push(t.id);
    }
  }

  if (anadidos.length > 0) {
    await escribirEntero(path.join(raiz, BASE_DATOS), JSON.stringify(db, null, 2));
    await guardarInventario(raiz, inv);
  }

  return { ok: true, recuperados: anadidos };
}

function generarAvisosRecuperacion(inventario) {
  const pendientesObras = (inventario?.obras || []).filter(o => !o.recuperada);
  const pendientesTrabajos = (inventario?.trabajos || []).filter(t => !t.recuperado);

  if (pendientesObras.length === 0 && pendientesTrabajos.length === 0) {
    return { mostrar: false };
  }

  return {
    mostrar: true,
    texto: 'Esta restauración ha dejado fuera obras y descargas posteriores. Sus archivos se han conservado.',
    acciones: ['Ver obras recuperables', 'Recuperar obra', 'Recuperar trabajos pendientes']
  };
}

module.exports = {
  validarIdObra,
  inventariarRestauracion,
  guardarInventario,
  listarRecuperables,
  recuperarObra,
  recuperarTrabajos,
  generarAvisosRecuperacion,
  CARPETA_COPIAS,
  FICHERO_ULTIMO
};
