const { proteger } = require('./glosario.js');

function aTextoPlano(html) {

  return require('./capitulo-valido.js').sinOculto(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function enFrases(texto) {
  const ABREVIATURAS = /\b(Mr|Mrs|Ms|Dr|St|Sr|Sra|Srta|vs|etc|p\.ej)\.$/i;
  const trozos = texto.split(/(?<=[.!?…])\s+/);

  const frases = [];
  let acumulado = '';
  for (const trozo of trozos) {
    acumulado = acumulado ? `${acumulado} ${trozo}` : trozo;
    if (ABREVIATURAS.test(acumulado.trim())) continue;
    frases.push(acumulado.trim());
    acumulado = '';
  }
  if (acumulado.trim()) frases.push(acumulado.trim());

  return frases.filter(f => f.length > 0);
}

function resumirCapitulo(html, glosario = [], cuantas = 3) {
  const texto = aTextoPlano(html);
  if (texto.length < 200) return '';

  const frases = enFrases(texto);
  if (frases.length <= cuantas) return frases.join(' ');

  const puntuadas = frases.map((frase, i) => {

    const largo = frase.length;
    if (largo < 40 || largo > 320) return { frase, i, puntos: -1 };

    let puntos = 0;

    const { tabla } = proteger(frase, glosario);
    puntos += tabla.length * 3;

    if (/["“”«»]/.test(frase)) puntos += 2;

    const posicion = i / frases.length;
    if (posicion > 0.8) puntos += 3;
    else if (posicion < 0.15) puntos += 2;

    if (/\b(decid|mat|muri|murió|descubr|revel|atac|salv|perd|gan|traicion|escap|prometi|jur)/i.test(frase)) puntos += 2;
    if (/\b(decid|kill|died|discover|reveal|attack|save|lost|won|betray|escap|promis|swore)/i.test(frase)) puntos += 2;

    return { frase, i, puntos };
  });

  return puntuadas
    .filter(p => p.puntos >= 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, cuantas)
    .sort((a, b) => a.i - b.i)
    .map(p => p.frase)
    .join(' ');
}

module.exports = { resumirCapitulo, aTextoPlano, enFrases };
