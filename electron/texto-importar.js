const crypto = require('node:crypto');

const TECHO_TEXTO = 2 * 1024 * 1024;
const escapar = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const encabezado = linea => {
  const m = linea.match(/^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/) || linea.match(/^\s*((?:Cap[ií]tulo|Chapter)\s+\d+\b.*)$/i);
  return m?.[1]?.trim();
};

function obraDeTexto({ titulo, texto, autor = '', fuente = '', urlOrigen = '' } = {}) {
  if (typeof titulo !== 'string' || !titulo.trim()) throw new Error('El texto necesita un título.');
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('No hay texto para importar.');
  if (Buffer.byteLength(texto, 'utf8') > TECHO_TEXTO) throw new Error('El texto supera el límite de 2 MB.');
  const normalizado = texto.replace(/\r\n?/g, '\n');
  const huella = crypto.createHash('sha256').update(normalizado, 'utf8').digest('hex').slice(0, 24);
  const partes = [];
  let actual = { title: titulo.trim(), lineas: [] };
  for (const linea of normalizado.split('\n')) {
    const nombre = encabezado(linea);
    if (nombre) {
      if (actual.lineas.some(x => x.trim())) partes.push(actual);
      actual = { title: nombre, lineas: [] };
    } else actual.lineas.push(linea);
  }
  if (actual.lineas.some(x => x.trim()) || !partes.length) partes.push(actual);
  if (!partes.some(p => p.lineas.some(x => x.trim()))) throw new Error('No hay texto para importar.');

  const html = p => p.lineas.join('\n').trim().split(/\n\s*\n/).filter(Boolean)
    .map(bloque => `<p>${escapar(bloque.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
  return { title: titulo.trim(), author: String(autor || '').trim(), synopsis: '',
    source: String(fuente || 'Texto').trim().slice(0, 100) || 'Texto',
    urlOrigen: String(urlOrigen || '').trim().slice(0, 4000), url: `texto:${huella}`,
    chapters: partes.map(p => ({ title: p.title, url: '' })), chapterContents: partes.map(html) };
}

module.exports = { obraDeTexto, TECHO_TEXTO };
