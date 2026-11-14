const { parrafos, sinTraducir } = require('./traduccion-a-medias.js');

const LETRAS = /\p{L}/gu;
const letras = (s) => (String(s).match(LETRAS) || []).length;
const fichas = (s) => String(s).match(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu) || [];
const FINAL_DE_FRASE = /[.!?…"”’'»)\]*_:;—–-]$/;

const VENTANA = 6, MIN_PROPIAS = 4;

const RATIO_MIN = 0.55, RATIO_MIN_CJK = 0.2;

const gravedad = (estado) => ({ completa: 0, sospechosa: 1, no_verificable: 1, incompleta: 2 })[estado] ?? 2;

const motivo = (nivel, codigo, prueba, detalle, extra = {}) => ({ nivel, codigo, gravedad: prueba ? 'prueba' : 'senal', detalle, ...extra });

const raiz = (f) => String(f).toLowerCase().replace(/['’]s?$/u, '');

const FRASES = /(?<=[.!?…:;]["”»’)\]]*)\s+|\s*["“”«»]\s*/u;

function protegidas(original, glosario) {
  const prot = new Set();
  for (const g of glosario || []) for (const f of fichas(`${g.termino} ${g.valor || ''}`)) prot.add(f.toLowerCase());

  for (const p of original) {
    for (const frase of String(p).split(FRASES)) {
      fichas(frase).forEach((f, i) => {

        if (i > 0 && /^\p{Lu}/u.test(f) && f.length >= 3 && !/^\p{Lu}+$/u.test(f) && !/['’]/u.test(raiz(f))) { prot.add(f.toLowerCase()); prot.add(raiz(f)); }
      });
    }
  }
  return prot;
}

function ristrasIguales(a, b, prot) {
  const claves = new Set();
  for (const p of a) {
    const t = fichas(p).map(x => x.toLowerCase());
    for (let i = 0; i + VENTANA <= t.length; i++) claves.add(t.slice(i, i + VENTANA).join(' '));
  }
  return b.map((p) => {
    const t = fichas(p).map(x => x.toLowerCase());
    const cubierto = new Array(t.length).fill(false);
    for (let i = 0; i + VENTANA <= t.length; i++) {
      const ventana = t.slice(i, i + VENTANA);
      if (claves.has(ventana.join(' ')) && ventana.filter(x => !prot.has(x) && !/^\d+$/.test(x)).length >= MIN_PROPIAS) {
        for (let k = i; k < i + VENTANA; k++) cubierto[k] = true;
      }
    }

    const propias = t.map((x, k) => (prot.has(x) || /^\d+$/.test(x) ? -1 : k)).filter(k => k >= 0);
    return propias.length ? propias.filter(k => cubierto[k]).length / propias.length : 0;
  });
}

function sinTraducirTramos(a, b, prot, evidencia) {
  const frac = ristrasIguales(a, b, prot);
  const afectados = [];
  frac.forEach((f, i) => { if (f > 0) afectados.push(i); });
  if (!afectados.length) return null;
  const enteros = afectados.filter(i => frac[i] >= 0.8);
  let racha = 0, maxRacha = 0;
  for (let i = 0; i < b.length; i++) { racha = frac[i] >= 0.8 ? racha + 1 : 0; maxRacha = Math.max(maxRacha, racha); }
  const grave = maxRacha >= 3 || enteros.length > Math.max(2, Math.ceil(b.length * 0.02));

  const limpia = evidencia && evidencia.originales === 0 && evidencia.recibidos >= evidencia.enviados;
  const prueba = grave && !limpia;
  const detalle = `${afectados.length} párrafo(s) con texto idéntico al original${limpia && grave ? ' (el servicio contestó todo: puede ser deliberado)' : ''}`;
  return motivo('B', prueba ? 'fragmentos-sin-traducir' : 'posibles-fragmentos-originales', prueba, detalle,
    { parrafos: afectados.slice(0, 8), posicion: afectados[0] / Math.max(1, b.length) });
}

function anclasDe(parrafo, prot) {
  return [...new Set(fichas(parrafo).filter(f => /^\d+$/.test(f) || (prot.has(raiz(f)) && f.length >= 3)).map(raiz))];
}

function tramosPerdidos(a, traducido, prot) {
  const fichasT = new Set(fichas(traducido).map(raiz));
  const tramos = Math.min(10, a.length);
  const porTramo = Array.from({ length: tramos }, () => new Map());
  a.forEach((p, i) => { const t = Math.min(tramos - 1, Math.floor(i * tramos / a.length)); for (const x of anclasDe(p, prot)) porTramo[t].set(x, (porTramo[t].get(x) || 0) + 1); });
  const total = new Map();
  porTramo.forEach(m => m.forEach((n, x) => total.set(x, (total.get(x) || 0) + n)));
  const perdidos = [];
  let verificables = 0;
  porTramo.forEach((m, t) => {
    const propias = [...m.keys()].filter(x => total.get(x) === m.get(x) && !/^\d$/.test(x));
    if (propias.length < 2) return;
    verificables++;
    const faltan = propias.filter(x => !fichasT.has(x));
    if (faltan.length / propias.length >= 0.65) perdidos.push({ tramo: t, faltan: faltan.length, de: propias.length });
  });
  return { perdidos, tramos, verificables };
}

function motivosDeEstructura(a, b, traducido, prot, ratio) {
  const salida = [];
  const { perdidos, tramos, verificables } = tramosPerdidos(a, traducido, prot);
  if (perdidos.length) {
    const alFinal = perdidos.some(p => p.tramo === tramos - 1);
    const faltan = perdidos.reduce((n, p) => n + p.faltan, 0), de = perdidos.reduce((n, p) => n + p.de, 0);
    salida.push(motivo('A', alFinal ? 'final-perdido' : 'bloque-perdido', faltan >= 3 && faltan / de >= 0.8,
      `${alFinal ? 'Falta el final' : 'Faltan bloques'} del original: ${faltan} de ${de} referencias (cifras y nombres) de ${perdidos.length} tramo(s) no aparecen`,
      { posicion: (perdidos[0].tramo + 0.5) / tramos, tramos: perdidos.map(p => p.tramo) }));
  } else if (!verificables && b.length < a.length * 0.95 && a.length - b.length >= 3 && ratio < 0.85) {

    salida.push(motivo('A', 'menos-bloques', false, `${b.length} bloques frente a ${a.length} y menos texto, sin referencias para comprobar qué falta`));
  }
  return salida;
}

function motivosDeCorte(a, b, ratio, cjk) {
  const salida = [];
  const minimo = cjk ? RATIO_MIN_CJK : RATIO_MIN;
  if (ratio < minimo) salida.push(motivo('C', 'reduccion-anomala', ratio < minimo / 2, `La traducción tiene el ${Math.round(ratio * 100)} % de las letras del original`));
  const conLetras = (l) => l.filter(p => letras(p) > 0);
  const ultimaT = conLetras(b).at(-1), ultimaO = conLetras(a).at(-1);
  if (ultimaT && ultimaO && FINAL_DE_FRASE.test(ultimaO.trim()) && !FINAL_DE_FRASE.test(ultimaT.trim())) {
    salida.push(motivo('C', 'final-cortado', false, `Acaba a media frase: «…${ultimaT.trim().slice(-60)}»`, { posicion: 1 }));
  }
  return salida;
}

function motivosDeSeparadores(originalHtml, traducidoHtml, a, b) {
  const cuenta = (html, l) => (html.match(/<hr\b/gi) || []).length + l.filter(p => p && letras(p) === 0).length;
  const o = cuenta(originalHtml, a), t = cuenta(traducidoHtml, b);
  return o >= 2 && t < o / 2 ? [motivo('C', 'separadores-perdidos', false, `El original tiene ${o} separadores de escena y la traducción ${t}`)] : [];
}

function motivosDeGlosario(originalTxt, traducidoTxt, glosario) {
  const salida = [];
  if (/\{\{\d+\}\}/.test(traducidoTxt)) salida.push(motivo('C', 'marca-sin-reponer', false, 'Quedan marcas del glosario ({{n}}) sin sustituir por su nombre'));
  const perdidos = [];
  for (const g of glosario || []) {
    const veces = originalTxt.toLowerCase().split(String(g.termino).toLowerCase()).length - 1;
    const esperado = String(g.valor || g.termino).toLowerCase();
    if (veces >= 3 && !traducidoTxt.toLowerCase().includes(esperado)) perdidos.push(g.termino);
  }
  if (perdidos.length) salida.push(motivo('C', 'glosario-perdido', false, `Términos del glosario que salen en el original y no en la traducción: ${perdidos.slice(0, 5).join(', ')}`));
  return salida;
}

function motivosDeEvidencia(evidencia) {
  if (!evidencia || !evidencia.originales) return [];
  const grave = evidencia.originales > Math.max(2, Math.ceil(evidencia.enviados * 0.05));
  return [motivo('D', grave ? 'fragmentos-originales' : 'fragmentos-originales-tolerados', grave,
    `${evidencia.originales} de ${evidencia.enviados} fragmentos se quedaron en el original al generarla`)];
}

function reglaAnterior(originalHtml, traducidoHtml) {
  const { iguales, total, comparable } = sinTraducir(originalHtml, traducidoHtml);
  return comparable && iguales > Math.max(2, Math.ceil(total * 0.05));
}

const estadoDe = (motivos) => motivos.some(m => m.gravedad === 'prueba') ? 'incompleta' : (motivos.length ? 'sospechosa' : 'completa');

function auditar(originalHtml, traducidoHtml, { glosario = [], evidencia = null } = {}) {
  if (!originalHtml || !String(originalHtml).trim()) return informe('no_verificable', [motivo('A', 'sin-original', false, 'Falta el original: no se puede comprobar')], evidencia);
  const a = parrafos(originalHtml), b = parrafos(traducidoHtml || '');
  const tA = a.join(' '), tB = b.join(' ');
  if (!letras(tA)) return informe('no_verificable', [motivo('A', 'original-sin-texto', false, 'El original no tiene texto que comparar')], evidencia);
  if (!letras(tB)) return informe('incompleta', [motivo('C', 'respuesta-vacia', true, 'La traducción está vacía')], evidencia);
  const cjk = letras(tB) > 0 && (tB.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || []).length / letras(tB) > 0.5;
  const ratio = letras(tB) / letras(tA);
  const prot = protegidas(a, glosario);
  const motivos = [
    ...motivosDeEstructura(a, b, tB, prot, ratio),
    ...motivosDeCorte(a, b, ratio, cjk),
    ...motivosDeSeparadores(originalHtml, traducidoHtml, a, b),
    ...motivosDeGlosario(tA, tB, glosario),
    ...motivosDeEvidencia(evidencia)
  ];
  const tramos = sinTraducirTramos(a, b, prot, evidencia);
  if (tramos) motivos.push(tramos);
  else if (!evidencia && reglaAnterior(originalHtml, traducidoHtml)) motivos.push(motivo('B', 'parrafos-identicos', false, 'Hay muchos párrafos idénticos al original (regla anterior)'));
  return informe(estadoDe(motivos), motivos, evidencia, b.length);
}

function informe(estado, motivos, evidencia, bloques = 0) {
  return { estado, motivos, fragmentos: evidencia?.enviados ?? bloques, fallidos: evidencia?.originales ?? 0,
    incidencias: motivos.map(m => `${m.codigo}: ${m.detalle}`) };
}

module.exports = { auditar, gravedad, protegidas, ristrasIguales, tramosPerdidos };
