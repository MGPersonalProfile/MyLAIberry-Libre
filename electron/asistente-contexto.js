const { createHash } = require('node:crypto');
const { JSDOM } = require('jsdom');
const SELECTOR = 'p,li,blockquote,h1,h2,h3,h4,h5,h6,pre,div';
function parrafos(html) {
  const dom = new JSDOM(String(html || ''));
  try {
    const root = dom.window.document.body;
    root.querySelectorAll('script,style,noscript,[hidden]').forEach(n => n.remove());
    const hojas = [...root.querySelectorAll(SELECTOR)].filter(n => !n.querySelector(SELECTOR));
    const textos = hojas.map(n => n.textContent.trim()).filter(Boolean);
    return textos.length ? textos : [root.textContent.trim()].filter(Boolean);
  } finally { dom.window.close(); }
}
const huella = texto => createHash('sha256').update(texto).digest('hex').slice(0, 20);
function validarPunto(p) {
  if (!p || !/^[\w-]{1,64}$/.test(p.workId) || !Number.isInteger(p.chapter) || p.chapter < 0 ||
      !Number.isInteger(p.paragraph) || p.paragraph < -1) throw new Error('Punto de lectura inválido.');
  return { workId: p.workId, chapter: p.chapter, paragraph: p.paragraph };
}
function antesOIgual(a, b) {
  return a?.workId === b?.workId && (a.chapter < b.chapter || (a.chapter === b.chapter && a.paragraph <= b.paragraph));
}
async function leerHasta({ point, getChapter, receipts, maxChars = 48000 }) {
  validarPunto(point);
  const blocks = [];
  let used = 0, omitted = 0;

  const chapters = Object.keys(receipts || {}).map(Number).filter(i => i <= point.chapter).sort((a, b) => b - a);
  for (const chapter of chapters) {
    const receipt = receipts[chapter];
    if (!receipt || receipt.paragraph < 0) continue;
    const html = await getChapter(point.workId, chapter);
    if (!html) continue;
    const parts = parrafos(html);
    if (receipt.hash !== huella(parts.join('\n'))) continue;
    const end = Math.min(receipt.paragraph, chapter === point.chapter ? point.paragraph : Infinity, parts.length - 1);
    for (let i = end; i >= 0; i--) {
      if (used + parts[i].length > maxChars) { omitted++; continue; }
      blocks.push({ workId: point.workId, chapter, paragraph: i, text: parts[i], hash: huella(parts[i]), ref: `${point.workId}:${chapter}:${i}` });
      used += parts[i].length;
    }
  }
  blocks.sort((a, b) => a.chapter - b.chapter || a.paragraph - b.paragraph);

  const leidos = chapters.filter(c => receipts[c]?.paragraph >= 0).sort((a, b) => a - b);
  return { point, blocks, omitted, leidos };
}
function terminos(s) {
  return [...new Set(String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
}
function buscarPasajes(blocks, query, limit = 12) {
  const words = terminos(query);
  return blocks.map(b => { const text = new Set(terminos(b.text)); return { ...b, matches: words.filter(p => text.has(p)).length }; })
    .filter(b => b.matches > 0).sort((a, b) => b.matches - a.matches).slice(0, limit);
}
module.exports = { parrafos, huella, validarPunto, antesOIgual, leerHasta, buscarPasajes };
