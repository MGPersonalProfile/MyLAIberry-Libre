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

const CAMPOS_SENSIBLES = ['subrayados', 'recaps', 'scrollPositions', 'currentChapter', 'lecturaRevision', 'lastReadAt', 'progresoEn', 'idiomaViaje'];

function detectarCambiosEnComunes(fanficsActuales, fanficsRestaurados) {
  const mapaRestaurados = new Map((fanficsRestaurados || []).map(f => [f.id, f]));
  const obrasModificadas = [];

  for (const fActual of fanficsActuales) {
    const fRest = mapaRestaurados.get(fActual.id);
    if (!fRest) continue;
    const cambios = CAMPOS_SENSIBLES.filter(campo => {
      const a = fActual[campo];
      const r = fRest[campo];
      return a !== undefined && JSON.stringify(a) !== JSON.stringify(r);
    });
    if (cambios.length > 0) {
      const idLimpio = validarIdObra(fActual.id);
      obrasModificadas.push({
        id: idLimpio,
        title: fActual.title || fActual.titulo || idLimpio,
        cambios,

        datosRestaurados: Object.fromEntries(cambios.filter(c => fRest[c] !== undefined).map(c => [c, fRest[c]])),
        datosPosteriores: fActual,
        recuperada: false
      });
    }
  }
  return obrasModificadas;
}

function auditarIntegridadReferencial(actual, restaurada) {
  const idsRestaurados = new Set((restaurada?.fanfics || []).map(f => f.id));
  const referenciasHuerfanas = [];
  const trabajos = [...(actual?.trabajos || []), ...(restaurada?.trabajos || [])];
  const vistos = new Set();

  for (const t of trabajos) {
    if (!t || vistos.has(t.id)) continue;
    vistos.add(t.id);
    const propietarioId = t.carga?.fanficId || t.fanficId || t.carga?.id;
    if (propietarioId && !idsRestaurados.has(propietarioId)) {
      referenciasHuerfanas.push({
        tipo: 'trabajo',
        id: t.id,
        propietarioId,
        estado: t.estado || 'pendiente'
      });
    }
  }
  return referenciasHuerfanas;
}

async function auditarRecursosFisicos(raiz, datosRestaurados) {
  const recursosAusentes = [];
  const fanfics = Array.isArray(datosRestaurados?.fanfics) ? datosRestaurados.fanfics : [];

  for (const f of fanfics) {
    if (!f.id) continue;
    const dirObra = path.join(raiz, 'fanfics', String(f.id));
    const total = Number(f.totalChapters) || (f.chapterList || []).length || 0;
    const presentes = [];
    const ausentes = [];

    for (let i = 0; i < total; i++) {
      const rutaCap = path.join(dirObra, `chapter_${i}.html`);
      const existe = await fs.stat(rutaCap).then(() => true).catch(() => false);
      if (existe) {
        presentes.push(i);
      } else {
        ausentes.push(i);
      }
    }

    if (total > 0) {
      f.downloadedChapters = presentes.length;
    }

    if (ausentes.length > 0) {
      recursosAusentes.push({
        obraId: String(f.id),
        totalDeclarados: total,
        disponiblesFisicos: presentes.length,
        capitulosAusentes: ausentes,
        capitulosPresentes: presentes
      });
    }
  }

  return recursosAusentes;
}

async function auditarRecursosObra(raiz, obraId) {
  const dirObra = path.join(raiz, 'fanfics', String(obraId));
  const capitulos = [];
  const traducciones = [];
  const audios = [];

  try {
    const ficheros = await fs.readdir(dirObra);
    for (const f of ficheros) {
      const mCap = f.match(/^chapter_(\d+)\.html$/);
      if (mCap) {
        const rutaCap = path.join(dirObra, f);
        const st = await fs.stat(rutaCap).catch(() => null);
        if (st && st.size > 0) capitulos.push(Number(mCap[1]));
        continue;
      }
      const mTrad = f.match(/^chapter_(\d+)\.([a-z0-9_-]+)\.html$/);
      if (mTrad) {
        const rutaTrad = path.join(dirObra, f);
        const st = await fs.stat(rutaTrad).catch(() => null);
        if (st && st.size > 0) traducciones.push({ capitulo: Number(mTrad[1]), idioma: mTrad[2] });
      }
    }
  } catch {}

  const dirAudio = path.join(dirObra, 'audio');
  try {
    const ficherosAudio = await fs.readdir(dirAudio);
    for (const f of ficherosAudio) {
      const mAudio = f.match(/^chapter_(\d+)\.([a-z0-9_-]+)\.mp3$/);
      if (mAudio) {
        const rutaAudio = path.join(dirAudio, f);
        const st = await fs.stat(rutaAudio).catch(() => null);
        if (st && st.size > 0) audios.push({ capitulo: Number(mAudio[1]), idioma: mAudio[2] });
      }
    }
  } catch {}

  capitulos.sort((a, b) => a - b);
  return { capitulos, traducciones, audios };
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
      const recursosConservados = await auditarRecursosObra(raiz, idLimpio);
      obrasExcluidas.push({
        id: idLimpio,
        title: f.title || f.titulo || idLimpio,
        carpetaExiste: existeCarpeta,
        recursosConservados,
        recuperada: false,
        datos: f
      });
    }
  }

  const obrasModificadas = detectarCambiosEnComunes(fanficsActuales, restaurada?.fanfics || []);
  const referenciasHuerfanas = auditarIntegridadReferencial(actual, restaurada);
  const recursosAusentes = await auditarRecursosFisicos(raiz, restaurada);
  const { trabajosExcluidos, terminados } = clasificarTrabajos(actual?.trabajos || [], restaurada?.trabajos || []);

  return {
    id: opciones.id || generarIdRestauracion(),
    fecha: new Date().toISOString(),
    origen: opciones.origen || null,
    antesDeRestaurar: opciones.antesDeRestaurar || null,
    obrasExcluidas,
    obrasModificadas,
    referenciasHuerfanas,
    recursosAusentes,
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

  const rutaUltimo = path.join(dirCopias, FICHERO_ULTIMO);

  if (fsOverride?.writeFile) {
    await fsOverride.writeFile(rutaUltimo, texto);
  } else {
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
  const rutaTx = path.join(raiz, CARPETA_COPIAS, 'restauracion-transaccion.json');
  const textoTx = await fs.readFile(rutaTx, 'utf-8').catch(() => null);

  let interrumpida = null;
  if (textoTx) {
    try {
      const tx = JSON.parse(textoTx);
      if (tx && tx.estado && tx.estado !== 'finalizada') {
        return { id: null, incompleta: true, estado: tx.estado, obras: [], trabajos: [] };
      }
      if (tx?.resuelta) interrumpida = { accion: tx.resuelta, estado: tx.estadoPrevio };
    } catch {}
  }

  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const texto = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!texto) return { id: null, interrumpida, obras: [], trabajos: [] };

  try {
    const inv = JSON.parse(texto);
    const db = await leerBase(raiz);
    const idsEnDb = new Set((db.fanfics || []).map(f => f.id));
    const idsTrabajos = new Set((db.trabajos || []).map(t => t.id));

    const obras = (inv.obrasExcluidas || []).map(o => ({
      ...o,
      recursosConservados: o.recursosConservados ? { ...o.recursosConservados } : null,
      recuperada: o.recuperada || idsEnDb.has(o.id)
    }));

    const obrasModificadas = (inv.obrasModificadas || []).map(({ datosPosteriores, datosRestaurados, ...o }) => o);
    const referenciasHuerfanas = (inv.referenciasHuerfanas || []).map(r => ({ ...r }));
    const recursosAusentes = (inv.recursosAusentes || []).map(r => ({ ...r }));
    const trabajos = (inv.trabajosExcluidos || []).map(t => ({
      ...t,
      recuperado: t.recuperado || idsTrabajos.has(t.id)
    }));

    return { id: inv.id, fecha: inv.fecha, interrumpida, obras, obrasModificadas, referenciasHuerfanas, recursosAusentes, trabajos };
  } catch {
    return { id: null, interrumpida, obras: [], trabajos: [] };
  }
}

async function recuperarObra(raiz, id) {
  const idLimpio = validarIdObra(id);
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const textoInv = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!textoInv) throw new Error('No hay inventario de recuperación disponible.');

  const inv = JSON.parse(textoInv);
  const rutaTx = path.join(raiz, CARPETA_COPIAS, 'restauracion-transaccion.json');
  const textoTx = await fs.readFile(rutaTx, 'utf-8').catch(() => null);
  if (textoTx) {
    const tx = JSON.parse(textoTx);
    if (tx?.id && inv?.id && tx.id !== inv.id) {
      throw new Error('Inventario no corresponde a la restauración activa.');
    }
  }
  const item = (inv.obrasExcluidas || []).find(o => o.id === idLimpio);
  if (!item) {
    if ((inv.obrasModificadas || []).some(o => o.id === idLimpio)) {
      return recuperarCambiosObra(raiz, idLimpio);
    }
    throw new Error(`Obra no encontrada en el inventario de recuperación: ${idLimpio}`);
  }

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

async function recuperarCambiosObra(raiz, id) {
  const idLimpio = validarIdObra(id);
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const textoInv = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!textoInv) throw new Error('No hay inventario de recuperación disponible.');

  const inv = JSON.parse(textoInv);
  const rutaTx = path.join(raiz, CARPETA_COPIAS, 'restauracion-transaccion.json');
  const textoTx = await fs.readFile(rutaTx, 'utf-8').catch(() => null);
  if (textoTx) {
    const tx = JSON.parse(textoTx);
    if (tx?.id && inv?.id && tx.id !== inv.id) {
      throw new Error('Inventario no corresponde a la restauración activa.');
    }
  }
  const item = (inv.obrasModificadas || []).find(o => o.id === idLimpio);
  if (!item) throw new Error(`Obra modificada no encontrada en inventario: ${idLimpio}`);

  const db = await leerBase(raiz);
  if (!Array.isArray(db.fanfics)) db.fanfics = [];
  const f = db.fanfics.find(o => o.id === idLimpio);
  if (!f) throw new Error(`Obra no presente en la base: ${idLimpio}`);

  const posterior = item.datosPosteriores || {};
  const restaurado = item.datosRestaurados;
  const conflictos = [];
  for (const campo of (item.cambios || [])) {
    if (posterior[campo] === undefined) continue;

    const sinTocar = restaurado
      ? JSON.stringify(f[campo]) === JSON.stringify(restaurado[campo])
      : !(f[campo]?.revision > posterior[campo]?.revision);
    if (sinTocar) f[campo] = JSON.parse(JSON.stringify(posterior[campo]));
    else conflictos.push(campo);
  }

  await escribirEntero(path.join(raiz, BASE_DATOS), JSON.stringify(db, null, 2));
  if (conflictos.length === 0) item.recuperada = true;
  await guardarInventario(raiz, inv);
  return { ok: true, obra: f, conflictos };
}

async function recuperarTrabajos(raiz, seleccion = []) {
  const rutaUltimo = path.join(raiz, CARPETA_COPIAS, FICHERO_ULTIMO);
  const textoInv = await fs.readFile(rutaUltimo, 'utf-8').catch(() => null);
  if (!textoInv) throw new Error('No hay inventario de recuperación disponible.');

  const inv = JSON.parse(textoInv);
  const rutaTx = path.join(raiz, CARPETA_COPIAS, 'restauracion-transaccion.json');
  const textoTx = await fs.readFile(rutaTx, 'utf-8').catch(() => null);
  if (textoTx) {
    const tx = JSON.parse(textoTx);
    if (tx?.id && inv?.id && tx.id !== inv.id) {
      throw new Error('Inventario no corresponde a la restauración activa.');
    }
  }
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
  recuperarCambiosObra,
  auditarIntegridadReferencial,
  auditarRecursosFisicos,
  auditarRecursosObra,
  recuperarTrabajos,
  generarAvisosRecuperacion,
  CARPETA_COPIAS,
  FICHERO_ULTIMO
};
