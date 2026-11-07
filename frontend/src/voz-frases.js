const FIN = '.!?…。！？';
const CIERRES = '"\'»”’)]';
const CJK = /[。！？]/u;

const ABREVIATURAS = /(?:^|[\s¿¡("«—])(?:sr|sra|srta|dr|dra|prof|lic|ing|mr|mrs|ms|st|vs|núm|pág)\.$/iu;

const minuscula = (c) => Boolean(c) && c !== c.toUpperCase() && c === c.toLowerCase();

export function frasesDe(texto) {
  const t = String(texto || '');
  const frases = [];
  let inicio = 0;
  const cerrar = (hasta) => {
    let d = inicio;
    let h = hasta;
    while (d < h && /\s/u.test(t[d])) d++;
    while (h > d && /\s/u.test(t[h - 1])) h--;
    if (h > d) frases.push({ desde: d, hasta: h });
    inicio = hasta;
  };
  let i = 0;
  while (i < t.length) {
    if (!FIN.includes(t[i])) { i++; continue; }
    let j = i;
    while (j < t.length && FIN.includes(t[j])) j++;
    while (j < t.length && CIERRES.includes(t[j])) j++;
    const sigue = t.slice(j).match(/^\s*(\S)?/u)[1];
    const hayEspacio = j >= t.length || /\s/u.test(t[j]);
    const final = j >= t.length || CJK.test(t[i]) || (hayEspacio && !minuscula(sigue) && !(t[i] === "." && j === i + 1 && ABREVIATURAS.test(t.slice(0, j))));
    if (final) cerrar(j);
    i = j;
  }
  if (inicio < t.length) cerrar(t.length);
  return frases;
}
