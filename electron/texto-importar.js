const crypto = require('node:crypto');

const TECHO_TEXTO = 2 * 1024 * 1024;
const escapar = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const LARGO_TITULO = 100;

const esProsa = s => /[.!?…»"”]$/.test(s) && s.split(/\s+/).length >= 6;

const encabezado = (linea, partida = false) => {
  const md = linea.match(/^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/);
  if (md) return { nombre: md[1].trim(), resto: '' };
  const m = linea.match(/^\s*((?:Cap[ií]tulo|Chapter)\s+\d+\b)(.*)$/i);
  if (!m) return null;
  const entero = (m[1] + m[2]).trim();
  const partido = { nombre: m[1].trim(), resto: m[2].replace(/^\s*[.:\-–—]\s*/, '').trim() };
  if (entero.length > LARGO_TITULO || (partida && esProsa(partido.resto))) return partido;
  return { nombre: entero, resto: '', respaldo: partido.resto ? partido : null };
};

const NUMERO = /^\s*(?:Cap[ií]tulo|Chapter)\s+(\d+)\b/i;
const CORTE_EN_LINEA = /(?<=[.!?…»"”')\]])\s+(?=(?:Cap[ií]tulo|Chapter)\s+\d+\s*[.:\-–—])/i;

const SEPARADOR = /^\s*(?:Cap[ií]tulo|Chapter)\s+\d+\s*([.:\-–—])/i;
function partirLinea(l) {
  const m = l.match(NUMERO);
  const trozos = m ? l.split(CORTE_EN_LINEA) : [l];
  const salida = [{ linea: trozos[0], partida: true }];
  let n = m ? Number(m[1]) : 0;
  const sep = l.match(SEPARADOR)?.[1];
  for (const t of trozos.slice(1)) {
    const k = Number(t.match(NUMERO)?.[1]);
    if (k === n + 1 && (!sep || t.match(SEPARADOR)?.[1] === sep)) { salida.push({ linea: t, partida: true }); n = k; }
    else salida[salida.length - 1].linea += ' ' + t;
  }
  return salida.length > 1 ? salida : [{ linea: l, partida: false }];
}
const lineasDe = texto => texto.split('\n').flatMap(partirLinea);
const conCuerpo = p => p.lineas.some(x => x.trim());

function obraDeTexto({ titulo, texto, autor = '', fuente = '', urlOrigen = '' } = {}) {
  if (typeof titulo !== 'string' || !titulo.trim()) throw new Error('El texto necesita un título.');
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('No hay texto para importar.');
  if (Buffer.byteLength(texto, 'utf8') > TECHO_TEXTO) throw new Error('El texto supera el límite de 2 MB.');
  const normalizado = texto.replace(/\r\n?/g, '\n');
  const huella = crypto.createHash('sha256').update(normalizado, 'utf8').digest('hex').slice(0, 24);
  const partes = [], titulos = [];
  let actual = { title: titulo.trim(), lineas: [] };
  const cerrar = () => { if (conCuerpo(actual) || actual.respaldo) partes.push(actual); };
  for (const { linea, partida } of lineasDe(normalizado)) {
    const e = encabezado(linea, partida);
    if (e) {
      cerrar();
      titulos.push(e.nombre);
      actual = { title: e.nombre, lineas: e.resto ? [e.resto] : [], respaldo: e.respaldo };
    } else actual.lineas.push(linea);
  }
  cerrar();

  const repetido = t => titulos.filter(x => x === t).length > 1;
  for (let i = partes.length - 1; i >= 0; i--) {
    const p = partes[i];
    if (conCuerpo(p)) continue;
    if (repetido(p.title)) partes.splice(i, 1);
    else partes[i] = { title: p.respaldo.nombre, lineas: [p.respaldo.resto] };
  }
  if (!partes.length) partes.push(actual);
  if (!partes.some(p => p.lineas.some(x => x.trim()))) throw new Error('No hay texto para importar.');

  const html = p => p.lineas.join('\n').trim().split(/\n\s*\n/).filter(Boolean)
    .map(bloque => `<p>${escapar(bloque.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
  return { title: titulo.trim(), author: String(autor || '').trim(), synopsis: '',
    source: String(fuente || 'Texto').trim().slice(0, 100) || 'Texto',
    urlOrigen: String(urlOrigen || '').trim().slice(0, 4000), url: `texto:${huella}`,
    chapters: partes.map(p => ({ title: p.title, url: '' })), chapterContents: partes.map(html) };
}

module.exports = { obraDeTexto, TECHO_TEXTO };
