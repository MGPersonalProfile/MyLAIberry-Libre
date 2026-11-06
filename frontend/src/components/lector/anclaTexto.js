export const normalizar = texto => String(texto || '').normalize('NFC').replace(/\s+/gu, ' ').trim();

export async function huellaDe(texto) {
  const bytes = new TextEncoder().encode(normalizar(texto));
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(resumen)].map(n => n.toString(16).padStart(2, '0')).join('')}`;
}

export async function crearAnclaTextual(textos, bloque, caracter, meta = {}) {
  const texto = normalizar(textos[bloque]);
  if (!texto || !Number.isInteger(caracter) || caracter < 0 || caracter > texto.length) return null;
  return {
    v: 2, obra: String(meta.obra || ''), capitulo: meta.capitulo,
    variante: String(meta.variante || 'original'), bloque, totalBloques: textos.length,
    caracter, huella: await huellaDe(texto),
    contexto: { antes: texto.slice(Math.max(0, caracter - 32), caracter),
      despues: texto.slice(caracter, caracter + 32) }
  };
}

const relativo = (ancla, total) => Math.min(total - 1,
  Math.max(0, Math.round(ancla.bloque * total / (ancla.totalBloques || total))));

function candidatoContextual(ancla, textos) {
  const antes = String(ancla.contexto?.antes || '');
  const despues = String(ancla.contexto?.despues || '');
  if (!antes && !despues) return null;
  const esperado = relativo(ancla, textos.length);
  let mejor = null;
  for (let i = 0; i < textos.length; i++) {
    const texto = normalizar(textos[i]);
    for (let j = 0; j <= texto.length; j++) {
      let aciertos = 0;
      let izquierda = j - 1;
      for (let k = antes.length - 1, saltos = 0; k >= 0 && izquierda >= 0;) {
        if (texto[izquierda] === antes[k]) { aciertos++; izquierda--; k--; }
        else if (saltos++ === 0 && /[^\p{L}\p{N}\s]/u.test(antes[k])) k--;
        else break;
      }
      let derecha = j;
      for (let k = 0, saltos = 0; k < despues.length && derecha < texto.length;) {
        if (texto[derecha] === despues[k]) { aciertos++; derecha++; k++; }
        else if (saltos++ === 0 && /[^\p{L}\p{N}\s]/u.test(despues[k])) k++;
        else break;
      }
      const razon = aciertos / (antes.length + despues.length);
      const puntuacion = razon - Math.min(0.3, Math.abs(i - esperado) * 0.05);
      if (!mejor || puntuacion > mejor.puntuacion) mejor = { bloque: i, caracter: j, puntuacion, razon };
    }
  }
  return mejor?.razon >= 0.72 ? { bloque: mejor.bloque, caracter: mejor.caracter, modo: 'contexto' } : null;
}

export async function resolverAnclaTextual(ancla, textos, variante) {
  if (!textos.length || !ancla || ancla.v !== 2) return null;
  const aproximado = { bloque: relativo(ancla, textos.length), caracter: null, modo: 'aproximado' };
  if (variante !== ancla.variante) return aproximado;
  const iguales = [];
  for (let i = 0; i < textos.length; i++) {
    if (await huellaDe(textos[i]) === ancla.huella) iguales.push(i);
  }
  if (iguales.length) {
    const bloque = iguales.sort((a, b) => Math.abs(a - ancla.bloque) - Math.abs(b - ancla.bloque))[0];
    return { bloque, caracter: Math.min(ancla.caracter, normalizar(textos[bloque]).length), modo: 'texto' };
  }
  return candidatoContextual(ancla, textos) || aproximado;
}
