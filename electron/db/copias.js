const fs = require('fs/promises');
const path = require('path');
const { escribirEntero } = require('../escritura-entera.js');
const { inventariarRestauracion, guardarInventario } = require('./recuperacion-restauracion.js');

const CARPETA = 'copias';
const BASE = 'mylaiberry-db.json';
const FICHERO_TRANSACCION = 'restauracion-transaccion.json';
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

async function guardarTransaccion(raiz, tx, { fsOverride } = {}) {
  const dir = path.join(raiz, CARPETA);
  await (fsOverride || fs).mkdir(dir, { recursive: true });
  const ruta = path.join(dir, FICHERO_TRANSACCION);
  const texto = JSON.stringify(tx, null, 2);
  if (fsOverride?.writeFile) await fsOverride.writeFile(ruta, texto);
  else await escribirEntero(ruta, texto);
}

async function comprobarRestauracionPendiente(raiz, { fsOverride } = {}) {
  const ruta = path.join(raiz, CARPETA, FICHERO_TRANSACCION);
  const texto = await (fsOverride || fs).readFile(ruta, 'utf-8').catch(() => null);
  if (!texto) return null;
  try {
    const tx = JSON.parse(texto);
    if (!tx || tx.estado === 'finalizada') return null;
    return { ...tx, incompleta: true };
  } catch {
    return null;
  }
}

async function resolverRestauracionIncompleta(raiz, { fsOverride } = {}) {
  const pendiente = await comprobarRestauracionPendiente(raiz, { fsOverride });
  if (!pendiente) return { ok: true, accion: 'ninguna' };

  const { incompleta, ...registro } = pendiente;
  const resolver = (resuelta) => guardarTransaccion(raiz, { ...registro, estado: 'finalizada', estadoPrevio: pendiente.estado, resuelta }, { fsOverride });

  if (pendiente.estado === 'inventario_guardado' || pendiente.estado === 'preparada') {
    await resolver('deshecha');
    return { ok: true, accion: 'deshecha' };
  }

  if (pendiente.estado === 'base_sustituida') {
    await resolver('completada');
    return { ok: true, accion: 'completada' };
  }

  return { ok: true, accion: 'ninguna' };
}

async function restaurarCopia(raiz, archivo, opciones = {}) {
  if (!NOMBRE.test(String(archivo || '')) || path.basename(archivo) !== archivo) throw new Error('Esa copia no existe.');

  await resolverRestauracionIncompleta(raiz, { fsOverride: opciones.fsOverride });
  const fsModulo = opciones.fsOverride || fs;
  const texto = await fsModulo.readFile(path.join(raiz, CARPETA, archivo), 'utf-8')
    .catch(() => { throw new Error('Esa copia no existe.'); });
  const datos = comprobar(texto);

  let datosActuales = { fanfics: [], trabajos: [] };
  try {
    const textoActual = await fsModulo.readFile(path.join(raiz, BASE), 'utf-8');
    datosActuales = comprobar(textoActual);
  } catch {

  }

  const transaccionId = `recup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const transaccion = { id: transaccionId, transaccionId, archivo, previa: null, estado: 'preparada', fecha: new Date().toISOString() };
  await guardarTransaccion(raiz, transaccion, opciones);
  if (opciones.interrumpirEn === 'preparada') throw new Error('Interrupción simulada en preparada');

  const previa = await hacerCopia(raiz, 'antes-de-restaurar');
  transaccion.previa = previa;
  const inventario = await inventariarRestauracion(raiz, datosActuales, datos, {
    id: transaccionId,
    origen: archivo,
    antesDeRestaurar: previa
  });

  await guardarInventario(raiz, inventario, opciones);
  transaccion.estado = 'inventario_guardado';
  await guardarTransaccion(raiz, transaccion, opciones);
  if (opciones.interrumpirEn === 'inventario_guardado') throw new Error('Interrupción simulada en inventario_guardado');

  const idsTerminados = new Set((inventario.trabajosTerminadosPosteriores || []).map(t => t.id));
  if (Array.isArray(datos.trabajos)) {
    datos.trabajos = datos.trabajos.filter(t => !idsTerminados.has(t.id));
  }

  const textoFinal = JSON.stringify(datos, null, 2);
  if (opciones.fsOverride?.writeFile) {
    await opciones.fsOverride.writeFile(path.join(raiz, BASE), textoFinal);
  } else {
    await escribirEntero(path.join(raiz, BASE), textoFinal);
  }
  transaccion.estado = 'base_sustituida';
  await guardarTransaccion(raiz, transaccion, opciones);
  if (opciones.interrumpirEn === 'base_sustituida') throw new Error('Interrupción simulada en base_sustituida');

  transaccion.estado = 'finalizada';
  await guardarTransaccion(raiz, transaccion, opciones);

  return { restaurada: archivo, obras: datos.fanfics.length, copiaDeAntes: previa, recuperacion: inventario };
}

module.exports = {
  hacerCopia,
  copiaDelDia,
  listarCopias,
  restaurarCopia,
  comprobarRestauracionPendiente,
  resolverRestauracionIncompleta,
  CARPETA,
  MAXIMO,
  MAXIMO_ANTES
};
