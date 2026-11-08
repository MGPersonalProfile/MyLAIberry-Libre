const fs = require('fs/promises');
const path = require('path');
const { escribirEntero } = require('../escritura-entera.js');
const { inventariarRestauracion, guardarInventario } = require('./recuperacion-restauracion.js');

const CARPETA = 'copias';
const BASE = 'mylaiberry-db.json';
const MAXIMO = 10;

const MAXIMO_ANTES = 5;

const NOMBRE = /^mylaiberry-db-(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})?(\d{3})?-(diaria|antes-de-restaurar)\.json$/;

const dos = (n) => String(n).padStart(2, '0');
function sello(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}_${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}${String(fecha.getMilliseconds()).padStart(3, '0')}`;
}

function comprobar(texto) {
  let datos;
  try { datos = JSON.parse(texto); } catch { throw new Error('La copia no es un JSON legible.'); }
  if (!datos || !Array.isArray(datos.fanfics)) throw new Error('La copia no parece una biblioteca de MyLAIberry (no tiene obras).');
  return datos;
}

async function copias(raiz) {
  const dir = path.join(raiz, CARPETA);
  const nombres = await fs.readdir(dir).catch(() => []);
  return nombres.filter(n => NOMBRE.test(n)).sort().reverse();
}

async function hacerCopia(raiz, motivo = 'diaria', { ahora = new Date() } = {}) {
  const texto = await fs.readFile(path.join(raiz, BASE), 'utf-8').catch(e => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  if (texto === null) return null;

  if (motivo === 'diaria') comprobar(texto);
  const dir = path.join(raiz, CARPETA);
  await fs.mkdir(dir, { recursive: true });
  const nombre = `mylaiberry-db-${sello(ahora)}-${motivo}.json`;
  await escribirEntero(path.join(dir, nombre), texto);

  const suyas = (await copias(raiz)).filter(n => n.endsWith(`-${motivo}.json`));
  for (const vieja of suyas.slice(motivo === 'diaria' ? MAXIMO : MAXIMO_ANTES)) {
    if (vieja !== nombre) await fs.rm(path.join(dir, vieja), { force: true }).catch(() => {});
  }
  return nombre;
}

async function copiaDelDia(raiz, { ahora = new Date() } = {}) {
  try {
    const hoy = sello(ahora).slice(0, 10);
    if ((await copias(raiz)).some(n => n.includes(`-${hoy}_`) && n.endsWith('-diaria.json'))) return null;
    return await hacerCopia(raiz, 'diaria', { ahora });
  } catch (e) {
    console.warn('[Copias] No se pudo hacer la copia del día:', e.message);
    return null;
  }
}

async function listarCopias(raiz) {
  const dir = path.join(raiz, CARPETA);
  const lista = [];
  for (const nombre of await copias(raiz)) {
    const [, dia, hh, mm, , , motivo] = nombre.match(NOMBRE);
    const ruta = path.join(dir, nombre);
    const { size } = await fs.stat(ruta);
    let obras = null;
    try { obras = comprobar(await fs.readFile(ruta, 'utf-8')).fanfics.length; } catch {  }
    lista.push({ archivo: nombre, fecha: `${dia} ${hh}:${mm}`, motivo, bytes: size, obras });
  }
  return lista;
}

async function restaurarCopia(raiz, archivo, { fsOverride } = {}) {
  if (!NOMBRE.test(String(archivo || '')) || path.basename(archivo) !== archivo) throw new Error('Esa copia no existe.');
  const fsModulo = fsOverride || fs;
  const texto = await fsModulo.readFile(path.join(raiz, CARPETA, archivo), 'utf-8')
    .catch(() => { throw new Error('Esa copia no existe.'); });
  const datos = comprobar(texto);

  let datosActuales = { fanfics: [], trabajos: [] };
  try {
    const textoActual = await fsModulo.readFile(path.join(raiz, BASE), 'utf-8');
    datosActuales = comprobar(textoActual);
  } catch {

  }

  const previa = await hacerCopia(raiz, 'antes-de-restaurar');
  const inventario = await inventariarRestauracion(raiz, datosActuales, datos, {
    origen: archivo,
    antesDeRestaurar: previa
  });

  await guardarInventario(raiz, inventario, { fsOverride });

  const idsTerminados = new Set((inventario.trabajosTerminadosPosteriores || []).map(t => t.id));
  if (Array.isArray(datos.trabajos)) {
    datos.trabajos = datos.trabajos.filter(t => !idsTerminados.has(t.id));
  }

  const textoFinal = JSON.stringify(datos, null, 2);
  if (fsOverride?.writeFile) {
    await fsOverride.writeFile(path.join(raiz, BASE), textoFinal);
  } else {
    await escribirEntero(path.join(raiz, BASE), textoFinal);
  }

  return { restaurada: archivo, obras: datos.fanfics.length, copiaDeAntes: previa, recuperacion: inventario };
}

module.exports = { hacerCopia, copiaDelDia, listarCopias, restaurarCopia, CARPETA, MAXIMO, MAXIMO_ANTES };
