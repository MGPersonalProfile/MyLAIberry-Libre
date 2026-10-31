const zlib = require('zlib');
const path = require('path');

const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_ENTRADA = 0x02014b50;

function buscarFinDeDirectorio(buf) {
  const minimo = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === FIRMA_FIN_DIRECTORIO) return i;
  }
  return -1;
}

function leerEntradas(buf) {
  const fin = buscarFinDeDirectorio(buf);
  if (fin < 0) throw new Error('No parece un fichero ZIP válido');

  const cuantas = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);

  const entradas = new Map();
  for (let i = 0; i < cuantas; i++) {
    if (buf.readUInt32LE(p) !== FIRMA_ENTRADA) break;

    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const desplazamiento = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);

    entradas.set(nombre, { metodo, comprimido, desplazamiento });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

function extraer(buf, entrada) {
  const p = entrada.desplazamiento;
  const largoNombre = buf.readUInt16LE(p + 26);
  const largoExtra = buf.readUInt16LE(p + 28);
  const inicio = p + 30 + largoNombre + largoExtra;
  const datos = buf.subarray(inicio, inicio + entrada.comprimido);

  if (entrada.metodo === 0) {
    if (datos.length > TECHO_POR_ENTRADA) throw sobreElTecho('Una entrada del EPUB pasa de 32 MB: no parece un libro.');
    return datos;
  }
  if (entrada.metodo === 8) return inflarConTecho(datos);
  throw new Error(`Compresión ZIP no soportada: método ${entrada.metodo}`);
}

const TECHO_POR_ENTRADA = 32 * 1024 * 1024;
const TECHO_DEL_LIBRO = 512 * 1024 * 1024;

const TECHO_DEL_FICHERO = 300 * 1024 * 1024;

function sobreElTecho(mensaje) {
  return Object.assign(new Error(mensaje), { sobreElTecho: true });
}

function inflarConTecho(datos) {
  try {
    return zlib.inflateRawSync(datos, { maxOutputLength: TECHO_POR_ENTRADA });
  } catch (e) {
    if (e.code === 'ERR_BUFFER_TOO_LARGE') {
      throw sobreElTecho('Una entrada del EPUB se descomprime a más de 32 MB: no parece un libro.');
    }
    throw e;
  }
}

function lectorDeTexto(buffer) {
  const entradas = leerEntradas(buffer);
  let total = 0;
  return (nombre) => {
    const e = entradas.get(nombre);
    if (!e) throw new Error(`El EPUB no trae ${nombre}`);
    const datos = extraer(buffer, e);
    total += datos.length;
    if (total > TECHO_DEL_LIBRO) {
      throw sobreElTecho('El EPUB se descomprime a más de 512 MB: no parece un libro.');
    }
    return datos.toString('utf-8');
  };
}

function lectoresJsdom() {
  const { JSDOM } = require('jsdom');
  const ventana = new JSDOM('').window;
  const parser = new ventana.DOMParser();
  return {
    xml: (t) => parser.parseFromString(t, 'text/xml'),
    html: (t) => parser.parseFromString(t, 'text/html'),
    cerrar: () => ventana.close()
  };
}

const ceder = () => new Promise(r => setImmediate(r));
const CAPITULOS_POR_TANDA = 10;

function resolverRuta(base, href) {
  const limpio = decodeURIComponent(String(href).split('#')[0]);
  return path.posix.normalize(path.posix.join(base, limpio));
}

async function leerCapitulos(buffer, p) {
  const leerXml = p.xml;
  const leerHtml = p.html || p.xml;
  const texto = lectorDeTexto(buffer);

  const contenedor = leerXml(texto('META-INF/container.xml'));
  const rutaOpf = contenedor.querySelector('rootfile')?.getAttribute('full-path');
  if (!rutaOpf) throw new Error('El EPUB no dice dónde está su índice');

  const opf = leerXml(texto(rutaOpf));
  const carpeta = path.posix.dirname(rutaOpf);

  const manifiesto = new Map();
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifiesto.set(item.getAttribute('id'), {
      href: item.getAttribute('href'),
      tipo: item.getAttribute('media-type') || ''
    });
  }

  const capitulos = [];
  const { leerIndice, dividirPorIndice } = require('./epub-indice');
  const indice = leerIndice(opf, carpeta, texto, { xml: leerXml, html: leerHtml });
  let vistos = 0;
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    if (++vistos % CAPITULOS_POR_TANDA === 0) await ceder();
    const item = manifiesto.get(ref.getAttribute('idref'));
    if (!item || !/xhtml|html/i.test(item.tipo)) continue;

    let html;
    try {
      html = texto(resolverRuta(carpeta, item.href));
    } catch (e) {
      if (e.sobreElTecho) throw e;
      continue;
    }

    const doc = leerHtml(html);
    const cuerpo = doc.querySelector('body');
    if (!cuerpo) continue;

    if (cuerpo.textContent.trim().length < 200) continue;

    const encabezado = cuerpo.querySelector('h1, h2, h3');
    const title = encabezado?.textContent.trim().replace(/\s+/g, ' ')
      || `Capítulo ${capitulos.length + 1}`;

    capitulos.push(...dividirPorIndice(doc, indice.get(resolverRuta(carpeta, item.href)), title));
  }

  return capitulos;
}

function leerMetadatos(buffer, p) {
  const leerXml = p.xml || p;

  const texto = lectorDeTexto(buffer);

  const contenedor = leerXml(texto('META-INF/container.xml'));
  const rutaOpf = contenedor.querySelector('rootfile')?.getAttribute('full-path');
  if (!rutaOpf) return {};

  const opf = leerXml(texto(rutaOpf));
  const dime = (etiqueta) => {
    const el = [...opf.querySelectorAll('metadata > *')]
      .find(e => e.tagName.toLowerCase().endsWith(etiqueta));
    return el?.textContent.trim() || '';
  };

  return {
    title: dime('title'),
    author: dime('creator'),
    synopsis: dime('description'),
    language: dime('language')
  };
}

module.exports = { leerCapitulos, leerMetadatos, leerEntradas, extraer, lectoresJsdom, TECHO_POR_ENTRADA, TECHO_DEL_FICHERO };
