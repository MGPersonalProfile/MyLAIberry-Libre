const MAX_RESULTADO = 6000;

const LARGO = 300;
const PESADOS = new Set(['chapterList', 'scrollPositions', 'glosario', 'recaps', 'resumenes']);

const RUIDO = new Set(['vistos']);
function sinRuido(v) {
  if (Array.isArray(v)) return v.map(sinRuido);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !RUIDO.has(k)).map(([k, x]) => [k, sinRuido(x)]));
}

function adelgazar(v, hondo = 0) {
  if (typeof v === 'string') return hondo >= 2 && v.length > LARGO ? v.slice(0, LARGO) + '…' : v;
  if (Array.isArray(v)) return v.map(x => adelgazar(x, hondo + 1));
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !PESADOS.has(k)).map(([k, x]) => [k, adelgazar(x, hondo + 1)]));
}

function recortar(valor) {
  const json = JSON.stringify(valor ?? { ok: true });
  if (json.length <= MAX_RESULTADO) return valor ?? { ok: true };
  const flaco = adelgazar(valor);
  if (JSON.stringify(flaco).length < json.length) return recortar(flaco);
  if (Array.isArray(valor)) {
    let n = valor.length;
    while (n > 1 && JSON.stringify(valor.slice(0, n)).length > MAX_RESULTADO) n = Math.floor(n * 0.7);
    return { recortado: `${n} de ${valor.length}`, datos: valor.slice(0, n) };
  }

  const [clave, lista] = Object.entries(valor || {}).filter(([, v]) => Array.isArray(v)).sort((a, b) => b[1].length - a[1].length)[0] || [];
  if (clave) {
    const recorte = recortar(lista);
    return { ...valor, [clave]: recorte.datos ?? lista, recortado: `${clave}: ${recorte.recortado ?? 'entero'}` };
  }
  return { recortado: true, datos: json.slice(0, MAX_RESULTADO) };
}

function conCuenta(resultado) {
  return Array.isArray(resultado) && resultado.length > 3 ? { cuantos: resultado.length, lista: resultado } : resultado;
}

function cabeEnElTope(messages, tools, max) {
  const peso = () => Buffer.byteLength(JSON.stringify({ messages, tools }), 'utf8');
  for (const m of messages) {
    if (peso() <= max) break;
    if (m.role !== 'tool' || String(m.content || '').length <= 600) continue;
    m.content = JSON.stringify({ resumido: 'Resultado de una ronda anterior, recortado para caber; si te hace falta entero, vuelve a pedirlo.',
      inicio: String(m.content).slice(0, 400) });
  }
  return messages;
}

module.exports = { recortar, sinRuido, adelgazar, conCuenta, cabeEnElTope, MAX_RESULTADO };
