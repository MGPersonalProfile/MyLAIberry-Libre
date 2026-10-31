const crypto = require('crypto');
const path = require('path');
const { leerPdf } = require('./pdf-leer.js');
const { capitulosDelPdf, htmlDeCapitulo } = require('./pdf-capitulos.js');
const { pulirCapitulos } = require('./pdf-pulir.js');

const PREFIJO = 'pdf:';

const tituloDelFichero = (nombre) =>
  path.basename(String(nombre || ''), path.extname(String(nombre || ''))).replace(/_+/g, ' ').trim() || 'PDF sin título';

async function obraDePdf(buffer, nombre, { proveedor = null, alAvanzar = () => {}, modelo } = {}) {
  const { titulo, autor, paginas } = await leerPdf(buffer);
  let capitulos = capitulosDelPdf(paginas);
  if (!capitulos.length) {
    throw new Error('Ese PDF no trae texto que se pueda leer: puede que sea un escaneo, sólo imágenes.');
  }
  let maquetado = { pulidos: 0, total: 0 };
  if (proveedor) {
    const r = await pulirCapitulos(capitulos, proveedor, alAvanzar, modelo);
    capitulos = r.capitulos;
    maquetado = { pulidos: r.pulidos, total: r.total };
  }
  const huella = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  return {
    title: titulo || tituloDelFichero(nombre),
    author: autor,
    synopsis: '',
    url: PREFIJO + huella,
    source: 'PDF',
    chapters: capitulos.map(c => ({ title: c.title, url: '' })),
    chapterContents: capitulos.map(htmlDeCapitulo),
    maquetado
  };
}

module.exports = { obraDePdf, PREFIJO };
