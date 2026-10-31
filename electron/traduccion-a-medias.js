const BLOQUE = /<(p|li|blockquote|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
const LETRAS = /\p{L}/gu;

function parrafos(html) {
  const lista = [];
  for (const m of require('./capitulo-valido.js').sinOculto(html).matchAll(BLOQUE)) {
    lista.push(m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return lista;
}

function sinTraducir(original, traducido) {
  const a = parrafos(original), b = parrafos(traducido);
  if (!a.length || a.length !== b.length) return { iguales: 0, total: a.length, comparable: false };
  let iguales = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i] && (a[i].match(LETRAS) || []).length >= 25) iguales++;
  }
  return { iguales, total: a.length, comparable: true };
}

const MARCA = '<!-- mylaiberry:traduccion-comprobada -->';

function marcar(html) {
  return String(html).includes(MARCA) ? html : `${html}\n${MARCA}`;
}

function aMedias(original, traducido) {
  if (String(traducido || '').includes(MARCA)) return false;
  const { iguales, total } = sinTraducir(original, traducido);
  return iguales > Math.max(2, Math.ceil(total * 0.05));
}

module.exports = { parrafos, sinTraducir, aMedias, marcar, MARCA };
