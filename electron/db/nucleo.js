const path = require('path');
const { copiarBiblioteca, apartar, ACTIVOS } = require('./copiar-biblioteca.js');
const { escribirEntero } = require('../escritura-entera.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const { app } = require('electron');

let db;
let userDataPath;

const ID_DE_OBRA = /^[A-Za-z0-9_-]{1,64}$/;

function carpetaDeObra(id) {
  const limpio = String(id ?? '');
  if (!ID_DE_OBRA.test(limpio)) {
    throw new Error(`Identificador de obra no valido: ${JSON.stringify(limpio).slice(0, 60)}`);
  }
  if (!userDataPath) userDataPath = getDataRoot();
  return path.join(userDataPath, 'fanfics', limpio);
}

let punteroRoto = null;

function getDataRoot() {
  const defecto = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '';
  punteroRoto = null;

  const pedida = process.env.MYLAIBERRY_DATOS;
  if (pedida && fsSync.existsSync(pedida)) return pedida;
  const puntero = path.join(defecto, 'location.json');
  try {
    const cfg = JSON.parse(fsSync.readFileSync(puntero, 'utf-8'));
    if (cfg.dataPath && fsSync.existsSync(cfg.dataPath)) return cfg.dataPath;

    if (cfg.dataPath) punteroRoto = { motivo: 'no-existe', ruta: cfg.dataPath };
  } catch (e) {

    if (e.code !== 'ENOENT') punteroRoto = { motivo: 'ilegible', ruta: puntero };
  }

  return defecto;
}

function getDataLocation() {
  const defecto = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '';

  const pedida = getDataRoot();
  const actual = raizActual();
  const aviso = punteroRoto || (path.resolve(pedida) !== path.resolve(actual) ? { motivo: 'reiniciar', ruta: pedida } : null);
  return { actual, defecto, personalizada: path.resolve(actual) !== path.resolve(defecto), punteroRoto: aviso };
}

async function setDataLocation(nuevaRuta) {

  const origen = raizActual();
  const destino = path.resolve(nuevaRuta);

  if (path.resolve(origen) === destino) {
    return { ok: true, sinCambios: true, ruta: destino };
  }
  if (destino.startsWith(path.resolve(origen) + path.sep)) {
    return { ok: false, error: 'La carpeta nueva no puede estar dentro de la actual.' };
  }

  const copia = await copiarBiblioteca(origen, destino);
  if (!copia.ok) return copia;

  const defecto = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '';
  try {
    if (defecto) {
      await fs.mkdir(defecto, { recursive: true });
      await escribirEntero(path.join(defecto, 'location.json'), JSON.stringify({ dataPath: destino, movedAt: Date.now() }, null, 2));
    }
  } catch (e) {
    await apartar(destino, ACTIVOS).catch(() => {});
    throw e;
  }

  db = null;
  userDataPath = destino;
  try {
    await initDB();
  } catch (e) {

    if (defecto) await escribirEntero(path.join(defecto, 'location.json'), JSON.stringify({ dataPath: origen, movedAt: Date.now() }, null, 2)).catch(() => {});
    db = null;
    userDataPath = origen;
    await initDB().catch(() => {});
    await apartar(destino, ACTIVOS).catch(() => {});
    throw e;
  }

  return { ok: true, ruta: destino, origenConservado: origen };
}

async function apuntarABibliotecaExistente(ruta) {
  const destino = path.resolve(String(ruta || ''));
  let datos;
  try { datos = JSON.parse(await fs.readFile(path.join(destino, 'mylaiberry-db.json'), 'utf-8')); } catch (e) {
    return { ok: false, error: e.code === 'ENOENT' ? 'En esa carpeta no hay ninguna biblioteca de MyLAIberry.' : 'La biblioteca de esa carpeta no se puede leer.' };
  }
  if (!datos || !Array.isArray(datos.fanfics)) return { ok: false, error: 'La biblioteca de esa carpeta no se puede leer.' };

  const apuntada = path.resolve(getDataRoot());
  if (apuntada === destino && !punteroRoto) return { ok: true, sinCambios: true, ruta: destino, obras: datos.fanfics.length };
  const defecto = (app && typeof app.getPath === 'function') ? app.getPath('userData') : '';
  await fs.mkdir(defecto, { recursive: true });
  await escribirEntero(path.join(defecto, 'location.json'), JSON.stringify({ dataPath: destino, movedAt: Date.now() }, null, 2));
  return { ok: true, ruta: destino, obras: datos.fanfics.length, reiniciar: path.resolve(raizActual()) !== destino };
}

async function initDB() {
  userDataPath = getDataRoot();

  const { JSONFile, Low } = await import('lowdb');

  await require('./copias.js').resolverRestauracionIncompleta(userDataPath).catch(e => console.error('Restauración a medias:', e));
  await require('./copias.js').copiaDelDia(userDataPath);
  db = new Low(new JSONFile(path.join(userDataPath, 'mylaiberry-db.json')));
  await db.read();

  if (!db.data) {
    db.data = {
      fanfics: [],
      settings: require('../ajustes-por-defecto.js').ajustesPorDefecto(),
      downloadQueue: [],
      trabajos: [],
      autores: [],
      suscripciones: [],
      fondos: {}
    };
    await writeDB();
  }

  try {
    await fs.mkdir(path.join(userDataPath, 'fanfics'), { recursive: true });
  } catch (e) {
    console.error('Error creando directorio fanfics:', e);
  }

  await require('./migraciones.js').aplicar({ db, writeDB });
}

async function leer() {
  if (!db) await initDB();
  await db.read();
  return db.data;
}

async function releerSiAbierta() {
  if (!db) return null;
  await db.read();
  return db.data;
}

function instancia() {
  return db;
}

function raizActual() {
  if (!userDataPath) userDataPath = getDataRoot();
  return userDataPath;
}

const ESTE_EQUIPO = (() => {
  try {
    return require('os').hostname() || 'equipo';
  } catch {
    return 'equipo';
  }
})();

let avisadoDeConflicto = false;

let alDetectarConflicto = null;
function alHaberConflicto(fn) { alDetectarConflicto = fn; }

function detectarOtroEquipo() {
  const marca = db?.data?._ultimaEscritura;
  if (!marca || marca.equipo === ESTE_EQUIPO) return null;

  const reciente = Date.now() - (marca.cuando || 0) < 2 * 60 * 1000;
  return reciente ? marca : null;
}

async function writeDB(intentos = 6) {
  const otro = detectarOtroEquipo();
  if (otro && !avisadoDeConflicto) {
    avisadoDeConflicto = true;
    console.warn(
      `[Sincronización] "${otro.equipo}" escribió esta biblioteca hace un momento. ` +
      'Si tienes la app abierta en dos equipos a la vez, los cambios de uno pueden pisar los del otro.'
    );
    if (alDetectarConflicto) alDetectarConflicto(otro.equipo);
  }

  if (db.data) db.data._ultimaEscritura = { equipo: ESTE_EQUIPO, cuando: Date.now() };

  return await escribirConReintentos(intentos);
}

async function escribirConReintentos(intentos = 6) {
  for (let i = 0; i < intentos; i++) {
    try {
      await db.write();
      return;
    } catch (err) {
      const transitorio = err && ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(err.code);
      if (!transitorio || i === intentos - 1) throw err;

      await new Promise(r => setTimeout(r, 80 * (i + 1)));
    }
  }
}

module.exports = {
  initDB,
  leer,
  releerSiAbierta,
  instancia,
  writeDB,
  carpetaDeObra,
  raizActual,
  getDataRoot,
  getDataLocation,
  setDataLocation,
  apuntarABibliotecaExistente,
  alHaberConflicto,
  ID_DE_OBRA
};
