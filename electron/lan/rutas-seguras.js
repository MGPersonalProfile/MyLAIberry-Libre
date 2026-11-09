const path = require('path');

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const INDICE_VALIDO = /^\d{1,6}$/;

const IDIOMA_VALIDO = /^[a-z]{2,8}$/;

function esIdValido(id) {
  return ID_VALIDO.test(String(id ?? ''));
}

function esIndiceValido(i) {
  return INDICE_VALIDO.test(String(i ?? ''));
}

function rutaSegura(base, ...segmentos) {
  const raiz = path.resolve(String(base || ''));
  const trozos = [];
  for (const s of segmentos) {
    const t = String(s ?? '');

    if (!t || t.includes('\0')) return null;

    for (const parte of t.split(/[/\\]+/)) {
      if (!parte) continue;

      if (/^\.+$/.test(parte)) return null;

      if (process.platform === 'win32' && /[. ]$/.test(parte)) return null;
    }
    trozos.push(t);
  }

  const destino = path.resolve(raiz, ...trozos);
  if (destino === raiz) return destino;

  const prefijo = raiz.endsWith(path.sep) ? raiz : raiz + path.sep;
  const a = process.platform === 'win32' ? destino.toLowerCase() : destino;
  const b = process.platform === 'win32' ? prefijo.toLowerCase() : prefijo;
  return a.startsWith(b) ? destino : null;
}

function esRutaDeBiblioteca(filePath, raiz) {
  try {
    const res = path.resolve(String(filePath || ''));
    const r = path.resolve(String(raiz || ''));
    return rutaSegura(r, path.relative(r, res)) !== null;
  } catch {
    return false;
  }
}

module.exports = { rutaSegura, esRutaDeBiblioteca, esIdValido, esIndiceValido, ID_VALIDO, INDICE_VALIDO, IDIOMA_VALIDO };
