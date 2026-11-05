const CON_CONTENIDO = /<(script|style|iframe|object|embed|form|svg|noscript|template)[\s\S]*?<\/\1\s*>/gi;

const SUELTAS = /<\/?(script|style|iframe|object|embed|form|svg|noscript|template|input|button|link|meta|base|frame|frameset|applet)\b[^>]*>/gi;

const EVENTOS_COMILLA_DOBLE = /[\s/]on[a-z]+\s*=\s*"[^"]*"/gi;
const EVENTOS_COMILLA_SIMPLE = /[\s/]on[a-z]+\s*=\s*'[^']*'/gi;
const EVENTOS_SIN_COMILLAS = /[\s/]on[a-z]+\s*=\s*[^\s>]+/gi;

const ESQUEMAS_PELIGROSOS = /(href|src|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data)\s*:[^"'>]*\2/gi;

function limpiarHtml(html) {
  let salida = incrustadosComoEnlaces(sinPublicidad(String(html || '')))
    .replace(CON_CONTENIDO, '')
    .replace(SUELTAS, '');

  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const antes = salida;
    salida = salida
      .replace(EVENTOS_COMILLA_DOBLE, '')
      .replace(EVENTOS_COMILLA_SIMPLE, '')
      .replace(EVENTOS_SIN_COMILLAS, '')
      .replace(ESQUEMAS_PELIGROSOS, '$1="#"');
    if (salida === antes) break;
  }

  return salida;
}

const INCRUSTADO = /<iframe\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"'\s>]+)["'][^>]*>(?:[\s\S]*?<\/iframe\s*>)?/gi;
const escapar = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function incrustadosComoEnlaces(html) {
  return html.replace(INCRUSTADO, (_, url) => {
    const visible = url.replace(/^https?:\/\/(www\.)?/, '');
    return `<a href="${escapar(url)}">▶ ${escapar(visible)}</a>`;
  });
}

const ANUNCIO = /\b(?:(?:class|id)\s*=\s*["'][^"']*\b(?:adsbygoogle|google-auto-placed|google-anno-skip|goog-rentr\w*|google-aiuf|aswift_\d+)|data-(?:google-vignette|ad-client|ad-slot|google-query-id)\b)/i;
const APERTURA = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
function cierreDe(html, nombre, desde) {
  const etiqueta = new RegExp(`<(/?)${nombre}\\b[^>]*?(/?)>`, 'gi');
  etiqueta.lastIndex = desde;
  let abiertas = 1;
  for (let m; (m = etiqueta.exec(html));) {
    if (m[1]) { if (--abiertas === 0) return etiqueta.lastIndex; } else if (!m[2]) abiertas++;
  }
  return desde;
}
function sinPublicidad(html) {
  if (!ANUNCIO.test(html)) return html;
  let salida = '', copiadoHasta = 0;
  APERTURA.lastIndex = 0;
  for (let m; (m = APERTURA.exec(html));) {
    if (!ANUNCIO.test(m[2])) continue;
    const fin = cierreDe(html, m[1], APERTURA.lastIndex);
    salida += html.slice(copiadoHasta, m.index);
    copiadoHasta = fin;
    APERTURA.lastIndex = fin;
  }
  return salida + html.slice(copiadoHasta);
}

module.exports = { limpiarHtml, incrustadosComoEnlaces, sinPublicidad };
