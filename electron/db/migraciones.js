async function camposQueFaltan({ db, writeDB }) {
  const listas = ['downloadQueue', 'trabajos', 'autores', 'suscripciones'];
  let tocado = false;

  for (const clave of listas) {
    if (!Array.isArray(db.data[clave])) { db.data[clave] = []; tocado = true; }
  }
  if (!db.data.fondos || typeof db.data.fondos !== 'object') {
    db.data.fondos = {};
    tocado = true;
  }

  if (tocado) await writeDB();
}

async function glosarioInicial({ db, writeDB }) {
  const sinGlosario = (db.data.fanfics || []).filter(f => !Array.isArray(f.glosario));
  if (sinGlosario.length === 0) return;

  const { sembrarDesdeEtiquetas } = require('../glosario.js');
  let conNombres = 0;
  for (const f of sinGlosario) {
    f.glosario = sembrarDesdeEtiquetas(f.tags);
    if (f.glosario.length > 0) conNombres++;
  }
  await writeDB();
  console.log(`[Migración] glosario sembrado en ${sinGlosario.length} obra(s); ${conNombres} con nombres.`);
}

async function origenDeCadaObra({ db, writeDB }) {
  const sinOrigen = (db.data.fanfics || []).filter(f => !f.origen);
  if (sinOrigen.length === 0) return;

  for (const f of sinOrigen) f.origen = 'propia';
  await writeDB();
  console.log(`[Migración] ${sinOrigen.length} obra(s) marcadas como 'propia'.`);
}

const VERSION_ETIQUETAS = 3;

async function normalizarLasEtiquetas({ db, writeDB }) {
  if (db.data._versionEtiquetas === VERSION_ETIQUETAS) return;

  const { normalizarEtiquetas } = require('../etiquetas.js');
  let obras = 0;
  for (const f of db.data.fanfics || []) {
    if (!Array.isArray(f.tags) || !f.tags.length) continue;
    const antes = JSON.stringify(f.tags);
    f.tags = normalizarEtiquetas(f.tags, f.source || '');
    if (JSON.stringify(f.tags) !== antes) obras++;
  }
  db.data._versionEtiquetas = VERSION_ETIQUETAS;
  await writeDB();
  console.log(`[Migración] etiquetas normalizadas en ${obras} obra(s).`);
}

const VERSION_GLOSARIO = 2;

async function resembrarGlosarios({ db, writeDB }) {
  if (db.data._versionGlosario === VERSION_GLOSARIO) return;

  let pendientes = 0;
  for (const f of db.data.fanfics || []) {
    if (f.glosarioResembrado) { delete f.glosarioResembrado; pendientes++; }
  }
  db.data._versionGlosario = VERSION_GLOSARIO;
  await writeDB();
  console.log(`[Migración] ${pendientes} glosario(s) a resembrar con el criterio nuevo.`);
}

async function cifrarLaClave({ db, writeDB }) {
  if (!db.data.settings?.claveIA) return;

  const { paraGuardar, estaCifrada } = require('../clave.js');
  if (estaCifrada(db.data.settings.claveIA)) return;

  const cifrada = paraGuardar(db.data.settings.claveIA);
  if (!estaCifrada(cifrada)) {
    console.warn('[Migración] este sistema no ofrece cifrado; la clave sigue en claro.');
    return;
  }
  db.data.settings.claveIA = cifrada;
  await writeDB();
  console.log('[Migración] la clave de API estaba en claro; ahora está cifrada.');
}

async function contadoresContraElDisco() {
  const { reconcileDownloadCounts } = require('./obras.js');
  const corregidos = await reconcileDownloadCounts();
  if (corregidos.length === 0) return;

  console.log(`[DB] Contadores corregidos en ${corregidos.length} fanfic(s):`);
  for (const f of corregidos) {
    console.log(`     "${f.title}": ${f.before} → ${f.after} capítulos`);
  }
}

async function portadasEnLaCarpetaActual({ db, writeDB }) {
  const fsSync = require('fs');
  const path = require('path');
  const { carpetaDeObra } = require('./nucleo.js');
  let movidas = 0;
  for (const f of db.data.fanfics || []) {
    if (!f.localCoverPath) continue;
    let aqui;
    try { aqui = path.join(carpetaDeObra(f.id), path.basename(String(f.localCoverPath))); } catch { continue; }
    if (aqui === f.localCoverPath || !fsSync.existsSync(aqui)) continue;
    f.localCoverPath = aqui;
    movidas++;
  }
  if (movidas) {
    await writeDB();
    console.log(`[DB] ${movidas} portada(s) apuntaban a otra carpeta: recolocadas.`);
  }
}

const MIGRACIONES = [
  camposQueFaltan,
  glosarioInicial,
  origenDeCadaObra,
  normalizarLasEtiquetas,
  resembrarGlosarios,
  cifrarLaClave,
  portadasEnLaCarpetaActual,
  contadoresContraElDisco
];

async function aplicar(contexto) {
  for (const migracion of MIGRACIONES) {
    await migracion(contexto);
  }
}

module.exports = { aplicar, MIGRACIONES };
