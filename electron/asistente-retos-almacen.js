const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = 1;
const TERMINALES = ['reanudado', 'cancelado', 'caducado', 'incompatible'];
const CONSERVAR_TERMINALES_MS = 24 * 60 * 60 * 1000;
const CERROJO_MUERTO_MS = 35 * 60 * 1000;
const ID_VALIDO = /^[A-Za-z0-9_-]{6,64}$/;
const CAMPOS = ['version', 'id', 'requestId', 'sitio', 'url', 'origen', 'estado', 'creadoEn', 'caducaEn', 'mensaje', 'operacion',
  'intentos', 'ultimoError', 'revision', 'resultado', 'equipo', 'actualizadoEn'];
const CREDENCIAL = /token|key|auth|sess|sig|pass|secret|code|cred|jwt/i;

const raizDeLaBiblioteca = () => require('./db.js').getDataLocation().actual;
const carpetaDe = raiz => path.join(raiz, 'asistente', 'retos-pendientes');

function limpiarUrl(url) {
  try {
    const u = new URL(String(url));
    u.hash = ''; u.username = ''; u.password = '';
    for (const clave of [...u.searchParams.keys()]) if (CREDENCIAL.test(clave)) u.searchParams.delete(clave);
    return u.toString();
  } catch { return null; }
}

function serializable(valor, hondo = 0) {
  if (hondo > 8) return false;
  if (valor === null || ['string', 'number', 'boolean'].includes(typeof valor)) return typeof valor !== 'number' || Number.isFinite(valor);
  if (Array.isArray(valor)) return valor.every(v => serializable(v, hondo + 1));
  if (typeof valor !== 'object' || Object.getPrototypeOf(valor) !== Object.prototype) return false;
  return Object.values(valor).every(v => v === undefined || serializable(v, hondo + 1));
}

function aDisco(reto, equipo, ahora) {
  const reg = { version: VERSION, equipo, actualizadoEn: ahora };
  for (const c of CAMPOS) if (!(c in reg) && reto[c] !== undefined) reg[c] = reto[c];
  reg.url = limpiarUrl(reg.url);
  if (!serializable(reg)) throw new Error('Un reto con datos que no se pueden guardar (funciones u objetos de Electron).');
  return reg;
}

function escribirAtomico(fichero, datos) {
  const tmp = `${fichero}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, JSON.stringify(datos)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, fichero);
}

function procesoVivo(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function crearAlmacen({ raiz = raizDeLaBiblioteca(), equipo = os.hostname(), ahora = Date.now, avisarFallo = () => {} } = {}) {
  const dir = carpetaDe(path.resolve(raiz));
  const dirResultados = path.join(dir, 'resultados');

  const ruta = (carpeta, id, ext = '.json') => {
    if (!ID_VALIDO.test(String(id))) throw new Error(`Identificador no válido: ${JSON.stringify(String(id)).slice(0, 40)}`);
    return path.join(carpeta, `${id}${ext}`);
  };
  const asegurar = carpeta => fs.mkdirSync(carpeta, { recursive: true });

  function guardar(reto) {
    asegurar(dir);
    escribirAtomico(ruta(dir, reto.id), aDisco(reto, equipo, ahora()));
  }

  function leerUno(fichero) {
    try { return JSON.parse(fs.readFileSync(fichero, 'utf8')); } catch (e) {
      try { fs.renameSync(fichero, `${fichero}.corrupto`); } catch {  }
      avisarFallo(`Reto pendiente ilegible apartado: ${path.basename(fichero)} (${e.message})`);
      return null;
    }
  }

  function cargar() {
    let nombres = [];
    try { nombres = fs.readdirSync(dir); } catch { return []; }
    const regs = [];
    for (const n of nombres) {
      const f = path.join(dir, n);
      if (n.endsWith('.tmp')) { try { fs.unlinkSync(f); } catch {  } continue; }
      if (!n.endsWith('.json')) continue;
      const reg = leerUno(f);
      if (!reg || typeof reg !== 'object' || reg.equipo !== equipo || !ID_VALIDO.test(String(reg.id)) || `${reg.id}.json` !== n) continue;
      if (TERMINALES.includes(reg.estado) && ahora() - (reg.actualizadoEn || 0) > CONSERVAR_TERMINALES_MS) {
        try { fs.unlinkSync(f); } catch {  }
        continue;
      }
      regs.push(reg);
    }
    return regs;
  }

  function guardarResultado(operacionId, resultado) {
    asegurar(dirResultados);
    const datos = { version: VERSION, operacionId, equipo, guardadoEn: ahora(), ...resultado };
    if (!serializable(datos)) throw new Error('Un resultado con datos que no se pueden guardar.');
    escribirAtomico(ruta(dirResultados, operacionId), datos);
  }
  function leerResultado(operacionId) {
    try { const r = JSON.parse(fs.readFileSync(ruta(dirResultados, operacionId), 'utf8')); return r.equipo === equipo ? r : null; } catch { return null; }
  }

  function bloquear(id) {
    asegurar(dir);
    const f = ruta(dir, id, '.lock');
    for (let intento = 0; intento < 2; intento++) {
      try { fs.writeFileSync(f, JSON.stringify({ pid: process.pid, equipo }), { flag: 'wx' }); return true; } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        let dueño = null, edad = 0;
        try { dueño = JSON.parse(fs.readFileSync(f, 'utf8')); edad = ahora() - fs.statSync(f).mtimeMs; } catch {  return false; }

        if (dueño?.equipo !== equipo || (procesoVivo(dueño.pid) && edad < CERROJO_MUERTO_MS)) return false;
        try { fs.unlinkSync(f); } catch {  }
      }
    }
    return false;
  }
  const soltarBloqueo = id => { try { fs.unlinkSync(ruta(dir, id, '.lock')); } catch {  } };

  return { dir, equipo, guardar, cargar, guardarResultado, leerResultado, bloquear, soltarBloqueo };
}

module.exports = { crearAlmacen, limpiarUrl, serializable, aDisco, VERSION, TERMINALES, carpetaDe };
