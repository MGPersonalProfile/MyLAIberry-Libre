const fs = require('fs');
const path = require('path');
const { rutaSegura, esIdValido, esIndiceValido } = require('./rutas-seguras.js');

const MIMES_DE_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ES_COMIC = /data-tipo=["']comic["']/;

function paraLaLan(html, id, n, manifiesto) {
  return html.replace(/<img\b[^>]*>/gi, (etiqueta) => {
    const i = /\bdata-indice=["']?(\d+)/i.exec(etiqueta)?.[1];
    const meta = i === undefined ? null : manifiesto?.imagenes?.[Number(i)];
    if (!meta) return etiqueta;
    return etiqueta.replace(/\sdata-bytes=["']?\d+["']?/i, '')
      .replace(/\bsrc=["'][^"']*["']/i, `src="../imagen-capitulo/${id}/${n}/${i}" data-bytes="${Math.max(0, Number(meta.bytes) || 0)}"`);
  });
}

function conComic(llamar, comic) {
  return async (canal, args) => {
    const valor = await llamar(canal, args);
    if (canal !== 'get-chapter-content' || typeof valor !== 'string' || !ES_COMIC.test(valor)) return valor;
    const [id, n] = args || [];
    if (!esIdValido(id) || !Number.isInteger(n) || n < 0 || typeof comic?.manifiesto !== 'function') return valor;
    const manifiesto = await comic.manifiesto(id, n).catch(() => null);
    return manifiesto?.completo === true ? paraLaLan(valor, id, n, manifiesto) : valor;
  };
}

async function resolverImagen(comic, id, n, i) {
  if (!esIdValido(id) || !esIndiceValido(n) || !esIndiceValido(i) || typeof comic?.manifiesto !== 'function') return null;
  const manifiesto = await comic.manifiesto(id, Number(n)).catch(() => null);
  const meta = manifiesto?.completo === true ? manifiesto.imagenes?.[Number(i)] : null;
  if (!meta || !MIMES_DE_IMAGEN.has(meta.mime) || typeof meta.archivo !== 'string' || path.basename(meta.archivo) !== meta.archivo) return null;
  const carpeta = comic.carpeta(id, Number(n));
  const ruta = rutaSegura(carpeta, meta.archivo);
  if (!ruta) return null;
  try {
    const real = fs.realpathSync(ruta), raiz = fs.realpathSync(carpeta);
    return rutaSegura(raiz, path.relative(raiz, real)) && fs.statSync(real).isFile() ? { ruta: real, mime: meta.mime } : null;
  } catch { return null; }
}

module.exports = { paraLaLan, conComic, resolverImagen, MIMES_DE_IMAGEN };
