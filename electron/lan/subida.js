const fs = require('fs');
const os = require('os');
const path = require('path');
const { TECHO_DEL_FICHERO } = require('../epub.js');

const TROZO = 4 * 1024 * 1024;
const EXTENSIONES = /\.(epub|pdf|html?)$/i;
const ID = /^[a-f0-9]{16,32}$/;
const MAX_A_LA_VEZ = 3;
const CADUCA_MS = 60 * 60 * 1000;
const CARPETA = path.join(os.tmpdir(), 'mylaiberry-subidas');

const enCurso = new Map();

function limpiarViejas(ahora = Date.now()) {
  for (const [id, s] of enCurso) {
    if (ahora - s.tocada > CADUCA_MS) { enCurso.delete(id); fs.rm(path.dirname(s.fichero), { recursive: true, force: true }, () => {}); }
  }
}

function anadirCuerpo(req, fichero, tope) {
  return new Promise((ok, mal) => {
    let llegados = 0;
    const salida = fs.createWriteStream(fichero, { flags: 'a' });
    req.on('data', (t) => {
      llegados += t.length;
      if (llegados > tope) { req.destroy(); salida.destroy(); mal(Object.assign(new Error('Ese trozo es más grande de lo anunciado.'), { codigo: 413 })); return; }
      if (!salida.write(t)) { req.pause(); salida.once('drain', () => req.resume()); }
    });
    let acabado = false;
    req.on('end', () => { acabado = true; salida.end(() => ok(llegados)); });
    req.on('error', (e) => { salida.destroy(); mal(e); });

    req.on('close', () => { if (!acabado) { salida.destroy(); mal(Object.assign(new Error('Se cortó la conexión a mitad de un trozo.'), { codigo: 400 })); } });
  });
}

async function atenderSubida(req, res, url, subirLibro, { json, drenar, mismoOrigen }) {
  const no = async (codigo, error, extra = {}) => { await drenar(req); return json(res, codigo, { error, ...extra }); };
  if (typeof subirLibro !== 'function') return no(404, 'No hay nada aquí.');
  if (!mismoOrigen(req)) return no(403, 'Origen no permitido.');
  const id = String(url.searchParams.get('id') || '');
  if (!ID.test(id)) return no(400, 'Subida no válida.');
  limpiarViejas();

  if (url.searchParams.get('fin') === '1') {
    await drenar(req);
    const s = enCurso.get(id);
    if (!s) return json(res, 404, { error: 'Esa subida no existe o caducó: vuelve a elegir el fichero.' });
    if (s.recibidos !== s.total) return json(res, 409, { error: 'Falta parte del fichero.', recibidos: s.recibidos });
    enCurso.delete(id);
    try {
      return json(res, 200, { valor: (await subirLibro(s.fichero, { nombre: s.nombre })) ?? null });
    } catch (e) {
      return json(res, 200, { error: String(e?.message || e) });
    } finally {
      fs.rm(path.dirname(s.fichero), { recursive: true, force: true }, () => {});
    }
  }

  const nombre = String(url.searchParams.get('nombre') || '').slice(0, 200);
  const total = Number(url.searchParams.get('total'));
  const desde = Number(url.searchParams.get('desde'));
  const largo = Number(req.headers['content-length']);
  if (!EXTENSIONES.test(nombre)) return no(415, 'Sólo se suben un EPUB, un PDF o un HTML de AO3.');
  if (!Number.isSafeInteger(total) || total <= 0) return no(400, 'Falta el tamaño del fichero.');
  if (total > TECHO_DEL_FICHERO) return no(413, 'Ese fichero pasa de 300 MB: no parece un libro.');
  if (!Number.isSafeInteger(largo) || largo <= 0 || largo > TROZO) return no(413, 'Trozo no válido.');
  let s = enCurso.get(id);
  if (!s) {
    if (desde !== 0) return no(409, 'Esa subida no existe o caducó: vuelve a empezar.', { recibidos: 0 });
    if (enCurso.size >= MAX_A_LA_VEZ) return no(429, 'Ya hay varios ficheros subiendo: espera a que acaben.');
    fs.mkdirSync(CARPETA, { recursive: true });
    const carpeta = fs.mkdtempSync(path.join(CARPETA, 'subida-'));
    s = { nombre, total, recibidos: 0, fichero: path.join(carpeta, 'libro' + path.extname(nombre).toLowerCase()), tocada: Date.now() };
    enCurso.set(id, s);
  }
  if (s.nombre !== nombre || s.total !== total) return no(409, 'Esa subida era de otro fichero.', { recibidos: s.recibidos });
  if (desde !== s.recibidos) return no(409, 'Ese trozo no es el que toca.', { recibidos: s.recibidos });
  if (desde + largo > total) return no(413, 'Eso pasa del tamaño anunciado.');
  try {
    s.recibidos += await anadirCuerpo(req, s.fichero, largo);
  } catch (e) {

    try { fs.truncateSync(s.fichero, s.recibidos); } catch {  }
    return json(res, e.codigo || 400, { error: e.message, recibidos: s.recibidos });
  }
  s.tocada = Date.now();
  return json(res, 200, { recibidos: s.recibidos });
}

module.exports = { atenderSubida, TROZO, CADUCA_MS, enCurso };
