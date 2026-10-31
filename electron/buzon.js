const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PENDIENTES_MAX = 200;
const RESUELTAS_MAX = 100;

function leer(ruta) {
  try {
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    return { version: 1, notas: Array.isArray(datos?.notas) ? datos.notas : [] };
  } catch {
    return { version: 1, notas: [] };
  }
}

function escribir(ruta, datos) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2));
  fs.renameSync(temporal, ruta);
}

function cambiar(ruta, fn) {
  const datos = leer(ruta);
  const resultado = fn(datos);
  const pendientes = datos.notas.filter(n => !n.resuelta).slice(-PENDIENTES_MAX);
  const resueltas = datos.notas.filter(n => n.resuelta).slice(-RESUELTAS_MAX);
  datos.notas = [...resueltas, ...pendientes].sort((a, b) => a.creada - b.creada);
  escribir(ruta, datos);
  return resultado;
}

const recortar = (t, n) => String(t ?? '').slice(0, n);

function anotar(ruta, { tipo = 'encargo', texto, contexto = '', origen = 'asistente' }) {
  if (!['encargo', 'fallo'].includes(tipo)) throw new Error('Tipo de nota no válido.');
  if (!String(texto || '').trim()) throw new Error('La nota está vacía.');
  const firma = tipo === 'fallo' ? recortar(texto, 300) : null;
  return cambiar(ruta, (datos) => {
    const igual = firma && datos.notas.find(n => !n.resuelta && n.tipo === 'fallo' && n.firma === firma);
    if (igual) {
      igual.veces = (igual.veces || 1) + 1;
      igual.ultima = Date.now();
      igual.contexto = recortar(contexto, 2000);
      return igual;
    }
    const nota = { id: randomUUID().slice(0, 8), tipo, texto: recortar(texto, 2000), contexto: recortar(contexto, 2000),
      origen, creada: Date.now(), ...(firma ? { firma, veces: 1 } : {}) };
    datos.notas.push(nota);
    return nota;
  });
}

function resolver(ruta, id, como = '') {
  return cambiar(ruta, (datos) => {
    const nota = datos.notas.find(n => n.id === id);
    if (!nota) throw new Error(`No hay ninguna nota «${id}».`);
    nota.resuelta = Date.now();
    nota.como = recortar(como, 1000);
    return nota;
  });
}

const pendientes = (ruta) => leer(ruta).notas.filter(n => !n.resuelta);

function crearBuzon(raiz) {

  if (typeof raiz !== 'string' || !raiz) throw new Error(`El buzón necesita la carpeta de datos y recibió ${Object.prototype.toString.call(raiz)}.`);
  const ruta = path.join(raiz, 'buzon.json');
  return {
    ruta,
    anotar: (nota) => anotar(ruta, nota),
    resolver: (id, como) => resolver(ruta, id, como),
    pendientes: () => pendientes(ruta),
    todas: () => leer(ruta).notas
  };
}

module.exports = { crearBuzon };
