const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const ACTIVOS = ['mylaiberry-db.json', 'fanfics', 'fondos', 'capturas', 'fundidas', 'copias'];
const PREFIJO = '.mylaiberry-mudanza-';

const MARCA = 'promoviendo.json';

const APARTADO = '.mylaiberry-apartado-';

async function limpiarRestos(destino) {
  if (!fsSync.existsSync(destino)) return;
  for (const nombre of await fs.readdir(destino)) {
    if (!nombre.startsWith(PREFIJO)) continue;
    const temporal = path.join(destino, nombre);
    let apuntados = [];
    try { apuntados = JSON.parse(await fs.readFile(path.join(temporal, MARCA), 'utf-8')); } catch {  }
    const promovidos = ACTIVOS.filter(a => Array.isArray(apuntados) && apuntados.includes(a) && !fsSync.existsSync(path.join(temporal, a)));
    await apartar(destino, promovidos);
    await fs.rm(temporal, { recursive: true, force: true });
  }
}

async function apartar(destino, nombres) {
  const presentes = nombres.filter(n => fsSync.existsSync(path.join(destino, n)));
  if (!presentes.length) return;
  const aparte = path.join(destino, APARTADO + Date.now());
  await fs.mkdir(aparte, { recursive: true });
  for (const n of presentes) await renombrarConReintentos(path.join(destino, n), path.join(aparte, n));
}

async function renombrarConReintentos(de, a, { rename = fs.rename, intentos = 6 } = {}) {
  for (let i = 0; ; i++) {
    try { return await rename(de, a); } catch (e) {
      if (!e || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || i === intentos - 1) throw e;
      await new Promise(r => setTimeout(r, 80 * (i + 1)));
    }
  }
}

async function copiarBiblioteca(origen, destino, { cp = fs.cp, copyFile = fs.copyFile, rename = fs.rename } = {}) {
  await limpiarRestos(destino);
  if (ACTIVOS.some(nombre => fsSync.existsSync(path.join(destino, nombre)))) {
    return { ok: false, error: 'Esta carpeta ya contiene datos de MyLAIberry. Elige una carpeta nueva para conservar ambas bibliotecas.' };
  }
  await fs.mkdir(destino, { recursive: true });

  const temporal = path.join(destino, PREFIJO + Date.now());
  await fs.mkdir(temporal);
  const presentes = ACTIVOS.filter(nombre => fsSync.existsSync(path.join(origen, nombre)));
  try {
    for (const nombre of presentes) {
      const de = path.join(origen, nombre);
      const a = path.join(temporal, nombre);
      if (nombre.endsWith('.json')) await copyFile(de, a, fsSync.constants.COPYFILE_EXCL);
      else await cp(de, a, { recursive: true, force: false, errorOnExist: true });
    }
    await fs.writeFile(path.join(temporal, MARCA), JSON.stringify(presentes), 'utf-8');
    for (const nombre of presentes) await rename(path.join(temporal, nombre), path.join(destino, nombre));
  } catch (e) {

    for (const nombre of presentes) {
      if (!fsSync.existsSync(path.join(temporal, nombre))) await fs.rm(path.join(destino, nombre), { recursive: true, force: true });
    }
    throw e;
  } finally {
    await fs.rm(temporal, { recursive: true, force: true });
  }
  return { ok: true };
}

module.exports = { copiarBiblioteca, apartar, renombrarConReintentos, ACTIVOS };
