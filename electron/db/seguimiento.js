const path = require('path');
const fs = require('fs').promises;
const { leer, writeDB, raizActual } = require('./nucleo.js');

async function getFondos() {
  const datos = await leer();
  return datos.fondos || {};
}

async function getFondosDe(fandom) {
  const todos = await getFondos();
  return todos[fandom] || [];
}

async function guardarFondos(fandom, imagenes) {
  const dir = path.join(raizActual(), 'fondos');
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const fichas = [];
  for (const img of imagenes) {

    const clave = require('crypto').createHash('sha1').update(img.url).digest('hex').slice(0, 16);
    const archivo = `${clave}.${img.tipo || 'jpg'}`;
    try {
      await fs.writeFile(path.join(dir, archivo), img.buf);
      fichas.push({ archivo, ancho: img.ancho, alto: img.alto, fuente: img.fuente });
    } catch {  }
  }

  const datos = await leer();
  if (!datos.fondos) datos.fondos = {};

  datos.fondos[fandom] = fichas;
  await writeDB();

  return fichas.length;
}

function rutaDeFondo(archivo) {
  return path.join(raizActual(), 'fondos', archivo);
}

async function getAutores() {
  const datos = await leer();
  return datos.autores || [];
}

async function seguirAutor({ url, nombre, fuente, vistos = [] }) {
  const datos = await leer();
  if (!Array.isArray(datos.autores)) datos.autores = [];
  if (datos.autores.some(a => a.url === url)) return false;

  datos.autores.push({
    url, nombre, fuente,
    vistos,
    seguidoDesde: Date.now(),
    comprobadoEn: 0
  });
  await writeDB();
  return true;
}

async function dejarDeSeguirAutor(url) {
  const datos = await leer();
  const antes = (datos.autores || []).length;
  datos.autores = (datos.autores || []).filter(a => a.url !== url);
  if (datos.autores.length !== antes) await writeDB();
  return antes !== datos.autores.length;
}

async function marcarAutorComprobado(url, vistos) {
  const datos = await leer();
  const autor = (datos.autores || []).find(a => a.url === url);
  if (autor) {
    autor.comprobadoEn = Date.now();
    if (Array.isArray(vistos)) autor.vistos = vistos;
    await writeDB();
  }
}

async function getSuscripciones() {
  const datos = await leer();
  return datos.suscripciones || [];
}

async function anadirSuscripcion({ consulta, fuente = 'AO3', umbral = {} }) {
  const datos = await leer();
  if (!Array.isArray(datos.suscripciones)) datos.suscripciones = [];

  const clave = `${fuente}|${consulta.toLowerCase().trim()}`;
  if (datos.suscripciones.some(s => `${s.fuente}|${s.consulta.toLowerCase().trim()}` === clave)) return false;

  datos.suscripciones.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    consulta, fuente,

    umbral: {
      kudosMinimos: umbral.kudosMinimos ?? 500,
      palabrasMinimas: umbral.palabrasMinimas ?? 20000,
      capitulosMinimos: umbral.capitulosMinimos ?? 1,
      soloCompletas: umbral.soloCompletas ?? false
    },
    vistos: [],
    comprobadoEn: 0,
    creadaEn: Date.now()
  });
  await writeDB();
  return true;
}

async function quitarSuscripcion(id) {
  const datos = await leer();
  const antes = (datos.suscripciones || []).length;
  datos.suscripciones = (datos.suscripciones || []).filter(s => s.id !== id);
  if (datos.suscripciones.length !== antes) await writeDB();
  return antes !== datos.suscripciones.length;
}

async function marcarSuscripcionComprobada(id, vistos, paginas, enEspera) {
  const datos = await leer();
  const s = (datos.suscripciones || []).find(x => x.id === id);
  if (s) {
    s.comprobadoEn = Date.now();
    if (Array.isArray(vistos)) s.vistos = vistos;

    if (paginas && typeof paginas === 'object') { s.paginas = paginas; delete s.pagina; }

    if (Array.isArray(enEspera)) s.enEspera = enEspera;
    await writeDB();
  }
}

module.exports = {
  getFondos,
  getFondosDe,
  guardarFondos,
  rutaDeFondo,
  getAutores,
  seguirAutor,
  dejarDeSeguirAutor,
  marcarAutorComprobado,
  getSuscripciones,
  anadirSuscripcion,
  quitarSuscripcion,
  marcarSuscripcionComprobada
};
