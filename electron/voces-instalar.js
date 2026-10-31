const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { leerEntradas, extraer } = require('./epub.js');
const { carpetaDePiper } = require('./voz-mp3.js');

const REVISION = '375a0fe641dea077c2a47b4e9a056d6da521eed3';
const BASE = `https://huggingface.co/rhasspy/piper-voices/resolve/${REVISION}/`;
const PIPER = {
  url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
  bytes: 22477236, sha: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea',
  exe: '96f3da3811151580073e40bb4dd20eb0fb8115f5f5f76e2fb54282b3edfa5c1f',
  arbolSha: '2b2a796dce894632a37f20d7a99d5acd8aabfb1669d8a6cc06d7747e1484773a'
};
const FFMPEG = {
  url: 'https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-essentials_build.zip',
  bytes: 114768076, sha: '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba',
  exe: '3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec'
};

const VOCES = [
  ['es/es_MX/claude/high/es_MX-claude-high', 63122309, '3ef40a71ea63852cd8ab7e6fa7d2ecdcfa67a0b47c9c48e3f10e02ee02083ea0', 4963, '1afc81f703c0e4cb3b4d7c0dca096b8b54a98806807f0170cf5eb5557723c12d'],
  ['es/es_ES/sharvard/medium/es_ES-sharvard-medium', 76733615, '40febfb1679c69a4505ff311dc136e121e3419a13a290ef264fdf43ddedd0fb1', 4903, '7438c9b699c72b0c3388dae1b68d3f364dc66a2150fe554a1c11f03372957b2c'],
  ['es/es_ES/davefx/medium/es_ES-davefx-medium', 63201294, '6658b03b1a6c316ee4c265a9896abc1393353c2d9e1bca7d66c2c442e222a917', 4817, '0e0dda87c732f6f38771ff274a6380d9252f327dca77aa2963d5fbdf9ec54842'],
  ['en/en_US/lessac/medium/en_US-lessac-medium', 63201294, '5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f', 4885, 'efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0'],
  ['en/en_US/hfc_female/medium/en_US-hfc_female-medium', 63201294, '914c473788fc1fa8b63ace1cdcdb44588f4ae523d3ab37df1536616835a140b7', 5033, '03f1fa0622b80463283592d97aca9f6e89aec345a5c56b7257723e0093c58b6c'],
  ['en/en_US/hfc_male/medium/en_US-hfc_male-medium', 63201294, 'd11e403a02bdf5a670c877b3dc56e0e1c8cece6fb30289586314dffdc0a78cb0', 5033, 'f66847424aed0bf99ecbb5d7cfde47c0a906f426a0daf7c46f305e7d21afd886'],
  ['en/en_US/joe/medium/en_US-joe-medium', 63201294, '58afce0321b8d9c46d7cdf9c16500cc55a793b4220212dba6b70fb788b3baf06', 4794, '3d6d5410b3795cb1950595247ef8f06190719e6fdbfa3a2356d8ec368e1aad33']
].flatMap(([ruta, bytes, sha, jsonBytes, jsonSha]) => [
  { nombre: `${path.posix.basename(ruta)}.onnx`, url: `${BASE}${ruta}.onnx`, bytes, sha },
  { nombre: `${path.posix.basename(ruta)}.onnx.json`, url: `${BASE}${ruta}.onnx.json`, bytes: jsonBytes, sha: jsonSha }
]);

const FUENTES = { piper: PIPER, ffmpeg: FFMPEG, voces: VOCES };
const SIN_WINDOWS = 'La instalación automática de voces sólo está disponible en Windows; usa scripts/instalar-voces.sh.';
const SIN_DATOS_MS = 30000;

const huella = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const huellaDelArbol = lista => huella(Buffer.from(JSON.stringify(
  [...lista].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
)));
async function huellaDeArchivo(fichero) {
  try {
    const h = crypto.createHash('sha256');
    for await (const bloque of fs.createReadStream(fichero)) h.update(bloque);
    return h.digest('hex');
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

async function arbolDePiper(dir) {
  const ficheros = [];
  async function visitar(actual) {
    for (const e of await fsp.readdir(actual, { withFileTypes: true })) {
      if (e.name === '.instalado.json') continue;
      const ruta = path.join(actual, e.name);
      if (e.isDirectory()) await visitar(ruta);
      else if (e.isFile()) ficheros.push([path.relative(dir, ruta).replace(/\\/g, '/'), await huellaDeArchivo(ruta)]);
      else throw new Error('Piper contiene un fichero que no es regular.');
    }
  }
  try { await visitar(dir); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  return huellaDelArbol(ficheros);
}

async function piperValido(carpeta, fuente) {
  const dir = path.join(carpeta, 'piper');
  let marca;
  try { marca = JSON.parse(await fsp.readFile(path.join(dir, '.instalado.json'), 'utf8')); }
  catch { return fuente.arbolSha ? await arbolDePiper(dir) === fuente.arbolSha : false; }
  if (marca.zip !== fuente.sha || !Array.isArray(marca.ficheros) || !marca.ficheros.length) return false;
  for (const [nombre, sha] of marca.ficheros) {
    if (!nombre || nombre.includes('..') || path.isAbsolute(nombre)) return false;
    if (await huellaDeArchivo(path.join(dir, nombre)) !== sha) return false;
  }
  return await huellaDeArchivo(path.join(dir, 'piper.exe')) === fuente.exe;
}

async function estadoCon(fuentes, { carpeta = carpetaDePiper() } = {}) {
  const faltan = [];
  let bytesABajar = 0;
  if (!(await piperValido(carpeta, fuentes.piper))) {
    faltan.push('Piper'); bytesABajar += fuentes.piper.bytes;
  }
  if (await huellaDeArchivo(path.join(carpeta, 'ffmpeg', 'ffmpeg.exe')) !== fuentes.ffmpeg.exe) {
    faltan.push('ffmpeg'); bytesABajar += fuentes.ffmpeg.bytes;
  }
  for (const voz of fuentes.voces) {
    if (await huellaDeArchivo(path.join(carpeta, 'voces', voz.nombre)) === voz.sha) continue;
    faltan.push(voz.nombre); bytesABajar += voz.bytes;
  }
  return { instalado: faltan.length === 0, faltan, bytesABajar };
}

function soloHttps(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error(`Descarga rechazada: sólo se admite HTTPS (${u.hostname}).`);
  return u;
}

async function respuestaHttps(url, fetchImpl, signal) {
  let actual = soloHttps(url);
  for (let i = 0; i <= 8; i++) {
    const r = await fetchImpl(actual.href, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const siguiente = r.headers.get('location');
      if (!siguiente) throw new Error('La descarga redirigió sin dirección.');
      actual = soloHttps(new URL(siguiente, actual).href);
      await r.body?.cancel?.();
      continue;
    }
    if (!r.ok) throw new Error(`La descarga respondió HTTP ${r.status}.`);
    return r;
  }
  throw new Error('Demasiadas redirecciones al descargar las voces.');
}

async function escribirBloque(fichero, bloque) {
  let p = 0;
  while (p < bloque.length) {
    const { bytesWritten } = await fichero.write(bloque, p);
    if (!bytesWritten) throw new Error('No se pudo escribir la descarga.');
    p += bytesWritten;
  }
}

async function recibir(fuente, destino, fetchImpl, signal, avanzar) {
  const parcial = `${destino}.parcial`;
  const control = new AbortController();
  const cancelar = () => control.abort(signal?.reason);
  signal?.addEventListener('abort', cancelar, { once: true });
  if (signal?.aborted) cancelar();
  let reloj;
  const reiniciar = () => { clearTimeout(reloj); reloj = setTimeout(() => control.abort('sin-datos'), SIN_DATOS_MS); };
  let fichero;
  try {
    await fsp.mkdir(path.dirname(destino), { recursive: true });
    await fsp.rm(parcial, { force: true });
    reiniciar();
    const respuesta = await respuestaHttps(fuente.url, fetchImpl, control.signal);
    fichero = await fsp.open(parcial, 'w');
    const lector = respuesta.body.getReader();
    const hash = crypto.createHash('sha256');
    let recibidos = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      reiniciar();
      const bloque = Buffer.from(value);
      recibidos += bloque.length;
      if (recibidos > fuente.bytes) throw new Error(`La descarga de ${path.basename(destino)} excede el tamaño fijado.`);
      hash.update(bloque);
      await escribirBloque(fichero, bloque);
      avanzar(bloque.length);
    }
    await fichero.close(); fichero = null;
    if (recibidos !== fuente.bytes || hash.digest('hex') !== fuente.sha) {
      throw new Error(`La huella SHA-256 de ${path.basename(destino)} no coincide; descarga descartada.`);
    }
    await sustituir(parcial, destino);
  } catch (e) {
    if (control.signal.reason === 'sin-datos') throw new Error(`La descarga de ${path.basename(destino)} se detuvo: 30 s sin datos.`);
    throw e;
  } finally {
    clearTimeout(reloj);
    signal?.removeEventListener('abort', cancelar);
    await fichero?.close();
    await fsp.rm(parcial, { force: true });
  }
}

function extraerGrande(zip, entrada) {
  const p = entrada.desplazamiento;
  if (zip.readUInt32LE(p) !== 0x04034b50) throw new Error('Cabecera ZIP dañada.');
  const inicio = p + 30 + zip.readUInt16LE(p + 26) + zip.readUInt16LE(p + 28);
  const datos = zip.subarray(inicio, inicio + entrada.comprimido);
  if (entrada.metodo === 0) return datos;
  if (entrada.metodo === 8) return zlib.inflateRawSync(datos, { maxOutputLength: 200 * 1024 * 1024 });
  throw new Error(`Compresión ZIP no soportada: ${entrada.metodo}.`);
}

async function apartarSiExiste(destino) {
  const apartado = `${destino}.anterior-${Date.now()}`;
  try { await fsp.rename(destino, apartado); return apartado; }
  catch (e) { if (e.code !== 'ENOENT') throw e; return null; }
}

async function sustituir(nuevo, destino) {
  const apartado = await apartarSiExiste(destino);
  try { await fsp.rename(nuevo, destino); }
  catch (e) {
    if (apartado) await fsp.rename(apartado, destino).catch(() => {});
    throw e;
  }
}

async function instalarPiper(carpeta, fuente, descargar) {
  const archivo = path.join(carpeta, 'piper.zip');
  const temporal = path.join(carpeta, 'piper.parcial');
  await descargar(fuente, archivo, 'Piper');
  try {
    const zip = await fsp.readFile(archivo);
    const entradas = leerEntradas(zip);
    await fsp.rm(temporal, { recursive: true, force: true });
    const ficheros = [];
    for (const [nombre, entrada] of entradas) {
      if (!nombre.startsWith('piper/') || nombre.endsWith('/')) continue;
      const relativo = nombre.slice(6);
      if (!relativo || relativo.split('/').includes('..') || relativo.includes('\\')) throw new Error('Ruta insegura dentro del ZIP de Piper.');
      const datos = extraer(zip, entrada);
      const destino = path.join(temporal, relativo);
      await fsp.mkdir(path.dirname(destino), { recursive: true });
      await fsp.writeFile(destino, datos);
      ficheros.push([relativo, huella(datos)]);
    }
    const ejecutable = ficheros.find(([n]) => n === 'piper.exe')?.[1];
    if (ejecutable !== fuente.exe) throw new Error('El ejecutable de Piper no coincide con su huella.');
    if (fuente.arbolSha && huellaDelArbol(ficheros) !== fuente.arbolSha) throw new Error('El ZIP de Piper no contiene el árbol de ficheros fijado.');
    await fsp.writeFile(path.join(temporal, '.instalado.json'), JSON.stringify({ zip: fuente.sha, ficheros }));
    await sustituir(temporal, path.join(carpeta, 'piper'));
  } finally {
    await fsp.rm(archivo, { force: true });
    await fsp.rm(temporal, { recursive: true, force: true });
  }
}

async function instalarFfmpeg(carpeta, fuente, descargar) {
  const archivo = path.join(carpeta, 'ffmpeg.zip');
  const parcial = path.join(carpeta, 'ffmpeg', 'ffmpeg.exe.parcial');
  await descargar(fuente, archivo, 'ffmpeg');
  try {
    const zip = await fsp.readFile(archivo);
    const entradas = [...leerEntradas(zip)].filter(([n]) => /\/bin\/ffmpeg\.exe$/i.test(n));
    if (entradas.length !== 1) throw new Error('El ZIP no trae un único bin/ffmpeg.exe.');
    const datos = extraerGrande(zip, entradas[0][1]);
    if (huella(datos) !== fuente.exe) throw new Error('El ejecutable de ffmpeg no coincide con su huella.');
    const destino = path.join(carpeta, 'ffmpeg', 'ffmpeg.exe');
    await fsp.mkdir(path.dirname(destino), { recursive: true });
    await fsp.writeFile(parcial, datos);
    await sustituir(parcial, destino);
  } finally {
    await fsp.rm(archivo, { force: true });
    await fsp.rm(parcial, { force: true });
  }
}

function crearInstalador(fuentes = FUENTES) {
  const estado = opciones => estadoCon(fuentes, opciones);
  async function instalar({ carpeta = carpetaDePiper(), progreso = () => {}, fetchImpl = fetch, signal } = {}) {
    if (process.platform !== 'win32') return { ok: false, motivo: SIN_WINDOWS };
    const antes = await estado({ carpeta });
    let recibidos = 0;
    const total = antes.bytesABajar;
    const descargar = (fuente, destino, archivo) => recibir(fuente, destino, fetchImpl, signal, n => {
      recibidos += n;
      progreso({ archivo, recibidos, total, porcentaje: total ? Math.min(100, Math.round(recibidos * 100 / total)) : 100 });
    });
    progreso({ archivo: '', recibidos: 0, total, porcentaje: total ? 0 : 100 });
    if (antes.faltan.includes('Piper')) await instalarPiper(carpeta, fuentes.piper, descargar);
    if (antes.faltan.includes('ffmpeg')) await instalarFfmpeg(carpeta, fuentes.ffmpeg, descargar);
    for (const voz of fuentes.voces) {
      if (!antes.faltan.includes(voz.nombre)) continue;
      const destino = path.join(carpeta, 'voces', voz.nombre);
      await descargar(voz, destino, voz.nombre);
    }
    const despues = await estado({ carpeta });
    if (!despues.instalado) throw new Error(`La instalación quedó incompleta: ${despues.faltan.join(', ')}.`);
    progreso({ archivo: '', recibidos: total, total, porcentaje: 100, terminado: true });
    return { ok: true, ...despues };
  }
  return { estado, instalar };
}

const { estado, instalar } = crearInstalador();
module.exports = { estado, instalar, crearInstalador, FUENTES };
