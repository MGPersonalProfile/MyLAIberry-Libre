const CON_CONTENIDO = /<(script|style|iframe|object|embed|form|svg|noscript|template)[\s\S]*?<\/\1\s*>/gi;

const SUELTAS = /<\/?(script|style|iframe|object|embed|form|svg|noscript|template|input|button|link|meta|base|frame|frameset|applet)\b[^>]*>/gi;

const EVENTOS_COMILLA_DOBLE = /[\s/]on[a-z]+\s*=\s*"[^"]*"/gi;
const EVENTOS_COMILLA_SIMPLE = /[\s/]on[a-z]+\s*=\s*'[^']*'/gi;
const EVENTOS_SIN_COMILLAS = /[\s/]on[a-z]+\s*=\s*[^\s>]+/gi;

const ESQUEMAS_PELIGROSOS = /(href|src|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data)\s*:[^"'>]*\2/gi;

function limpiarHtml(html) {
  let salida = incrustadosComoEnlaces(String(html || ''))
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

module.exports = { limpiarHtml, incrustadosComoEnlaces };
