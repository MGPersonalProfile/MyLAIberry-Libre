const fs = require('node:fs');
const path = require('node:path');

const FICHERO = path.join(__dirname, 'novedades.json');
const SIGUIENTE = 'siguiente';

function leer(fichero = FICHERO) {
  try { return JSON.parse(fs.readFileSync(fichero, 'utf8')); } catch { return []; }
}

const conContenido = (e) => !!e && !!String(e.resumen || '').trim() && Array.isArray(e.detalle) && e.detalle.length > 0;

function comparar(a, b) {
  const partes = (v) => v === SIGUIENTE ? [Infinity] : String(v).split(/[.-]/).map(Number);
  const x = partes(a); const y = partes(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? (i === 3 ? 1 : 0)) - (y[i] ?? (i === 3 ? 1 : 0));
    if (d) return d;
  }
  return 0;
}

function novedadesDesde(desde, lista = leer()) {
  return lista.filter(conContenido).filter(e => !desde || comparar(e.version, desde) > 0)
    .sort((a, b) => comparar(b.version, a.version));
}

function ponerVersion(version, fecha, fichero = FICHERO) {
  const lista = leer(fichero);
  const sig = lista.find(e => e.version === SIGUIENTE);
  const ya = lista.find(e => e.version === version);
  if (!conContenido(sig) && !conContenido(ya)) {
    throw new Error(`No hay novedades para ${version}: escribe en electron/novedades.json la entrada "siguiente" ` +
      '(resumen y detalle, en lenguaje de usuario). Orden del autor: el asistente le cuenta cada actualización.');
  }
  if (conContenido(sig)) { sig.version = version; sig.fecha = fecha; }
  fs.writeFileSync(fichero, JSON.stringify(lista, null, 2) + '\n');
  return lista;
}

function faltanNovedades(cambiados) {
  const codigo = cambiados.filter(f => /^(electron|frontend\/src|mcp\/src)\//.test(f) && !/novedades\.json$/.test(f));
  return codigo.length > 0 && !cambiados.includes('electron/novedades.json');
}

function queHayDeNuevo({ desde, nivel } = {}, { vista = null, version = null, lista = leer() } = {}) {
  const aFondo = nivel === 'a_fondo';
  const desdeEfectivo = desde || vista || null;

  const entradas = novedadesDesde(desdeEfectivo, lista).slice(0, desdeEfectivo ? undefined : 3).map(e => ({
    version: e.version === SIGUIENTE ? 'la que viene (aún sin número)' : e.version,
    fecha: e.fecha || null,
    resumen: e.resumen,
    ...(aFondo ? { detalle: e.detalle.map(d => ({ que: d.que, porque: d.porque })) } : { cambios: e.detalle.length })
  }));
  return { versionInstalada: version || 'no consta', desde: desdeEfectivo || 'el principio', nivel: aFondo ? 'a_fondo' : 'breve',

    nada: entradas.length === 0, entradas,
    marcar: novedadesDesde(desdeEfectivo, lista).find(e => e.version !== SIGUIENTE)?.version || null };
}

module.exports = { FICHERO, SIGUIENTE, leer, novedadesDesde, ponerVersion, faltanNovedades, comparar, queHayDeNuevo };
