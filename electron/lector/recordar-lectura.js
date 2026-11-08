const { resumirCapitulo } = require('../recap.js');

const ALGORITMO = 2;
const VENTANA = 5;
const MAX_PALABRAS = 180;

async function capitulosAutorizados(fanfic, memoria, huellaDeLectura) {
  const actual = Number.isInteger(fanfic?.currentChapter) ? fanfic.currentChapter : 0;
  const prefijo = `${fanfic?.id}:`;
  const autorizados = [];
  for (const [clave, marca] of Object.entries(memoria?.terminados || {})) {
    if (!clave.startsWith(prefijo) || typeof marca !== 'string' || !marca || typeof huellaDeLectura !== 'function') continue;
    const i = Number(clave.slice(prefijo.length));
    if (!Number.isInteger(i) || i < 0 || i >= actual) continue;
    if (await huellaDeLectura(i) === marca) autorizados.push(i);
  }
  return autorizados.sort((x, y) => x - y);
}

async function limiteDeLectura(fanfic, memoria, huellaDeLectura) {
  const autorizados = await capitulosAutorizados(fanfic, memoria, huellaDeLectura);
  return { limite: autorizados.length ? autorizados.at(-1) : -1, autorizados, estimado: false, sinEvidencia: !autorizados.length };
}

const huellaDe = (html) => require('crypto').createHash('sha256').update(String(html)).digest('hex').slice(0, 16);

function recortar(texto) {
  if (texto.split(/\s+/).length <= MAX_PALABRAS) return texto;
  const palabras = texto.split(/\s+/).slice(0, MAX_PALABRAS).join(' ');
  const corte = Math.max(palabras.lastIndexOf('. '), palabras.lastIndexOf('! '), palabras.lastIndexOf('? '));
  return corte > 0 ? palabras.slice(0, corte + 1) : palabras;
}

const igualLista = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, k) => x === b[k]);

function cacheVigente(e, { obra, limite, modo, huellas, autorizados, usados }) {
  if (!e || e.algoritmo !== ALGORITMO || e.modo !== modo || e.limite !== limite || e.obra !== obra) return false;
  if (!igualLista(e.autorizados, autorizados) || !igualLista(e.capitulos, usados) || e.capitulos.some(i => i > limite)) return false;
  return e.capitulos.every(i => e.huellas?.[i] === huellas[i]);
}

function fechaLegible(ms, lang = 'es') {
  const locale = lang === 'en' ? 'en-US' : 'es-ES';
  return ms ? new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
}

function textoDeProgreso(fanfic, ahora, lang = 'es') {
  const actual = (Number(fanfic.currentChapter) || 0) + 1;
  const total = Math.max((fanfic.chapterList || []).length, Number(fanfic.totalChapters) || 0);
  const delante = total ? Math.max(0, total - actual) : 0;
  const cuando = fechaLegible(fanfic.lastReadAt, lang);
  const dias = fanfic.lastReadAt ? Math.floor((ahora - fanfic.lastReadAt) / 86400000) : null;
  if (lang === 'en') {
    return `You were on chapter ${actual}.${cuando ? ` Last read on ${cuando}${dias > 0 ? ` (${dias} day${dias === 1 ? '' : 's'} ago)` : ''}.` : ''}`
      + ` You have ${delante} chapter${delante === 1 ? '' : 's'} ahead.`;
  }
  return `Te quedaste en el capítulo ${actual}.${cuando ? ` Leíste por última vez el ${cuando}${dias > 0 ? ` (hace ${dias} días)` : ''}.` : ''}`
    + ` Tienes ${delante} capítulos por delante.`;
}

async function recordarLectura({ fanfic, memoria, modo = 'breve', leerCapitulo, huellaDeLectura, glosario = [], cache, ahora = Date.now(), revalidarAutorizacion, lang = 'es' }) {
  const { limite, estimado, autorizados, sinEvidencia } = await limiteDeLectura(fanfic, memoria, huellaDeLectura);
  const base = { status: 'ok', obra: fanfic.title, obraId: String(fanfic.id),
    lecturaRevision: Number.isInteger(fanfic.lecturaRevision) ? fanfic.lecturaRevision : 0,
    currentChapter: Number.isInteger(fanfic.currentChapter) ? fanfic.currentChapter : 0,
    modo, limite, estimado, sinEvidencia, capitulos: [], porDelante: null,
    ultimaLectura: fanfic.lastReadAt || null, coste: { llamadasModelo: 0, peticionesWeb: 0 } };
  if (modo === 'progreso') return { ...base, texto: textoDeProgreso(fanfic, ahora, lang), origen: 'ninguno' };
  if (limite < 0) return { ...base, texto: '', origen: 'ninguno' };

  const capitulos = [], huellas = {}, htmls = {};
  for (const i of autorizados.slice(-VENTANA)) {
    const html = await leerCapitulo(i);
    if (html == null) continue;
    capitulos.push(i); huellas[i] = huellaDe(html); htmls[i] = html;
  }
  if (!capitulos.length) return { ...base, texto: '', origen: 'ninguno' };

  if (typeof revalidarAutorizacion === 'function') {
    const actual = await revalidarAutorizacion();
    const cap = Number.isInteger(actual?.currentChapter) ? actual.currentChapter : null;
    const rev = Number.isInteger(actual?.lecturaRevision) ? actual.lecturaRevision : null;
    if ((cap !== null && (cap <= limite || capitulos.some(c => c >= cap)))
      || (rev !== null && Number.isInteger(fanfic?.lecturaRevision) && rev !== fanfic.lecturaRevision)) {
      return { ...base, limite: -1, capitulos: [], sinEvidencia: true, texto: '', origen: 'ninguno' };
    }
  }

  const guardada = cache?.leer();
  if (cacheVigente(guardada, { obra: String(fanfic.id), limite, modo, huellas, autorizados, usados: capitulos })) {
    return { ...base, capitulos, texto: guardada.texto, origen: 'cache' };
  }
  const partes = capitulos.map(i => resumirCapitulo(htmls[i], glosario, 2)).filter(Boolean);
  const texto = recortar(partes.join(' '));
  cache?.guardar({ algoritmo: ALGORITMO, obra: String(fanfic.id), modo, limite, autorizados, capitulos, huellas, texto, hechoEn: ahora });
  return { ...base, capitulos, texto, origen: texto ? 'extractivo' : 'ninguno' };
}

module.exports = { limiteDeLectura, capitulosAutorizados, recordarLectura, ALGORITMO };
