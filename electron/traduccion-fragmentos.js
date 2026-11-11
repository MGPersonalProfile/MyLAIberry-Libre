const { traducirTextoConProcedencia } = require('./traduccion-clientes.js');

const MAX_CARACTERES_LOTE = 4000;

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function armarLotes(limpios) {
  const lotes = [];
  let actual = [], largo = 0;
  limpios.forEach((frag, i) => {
    if (actual.length > 0 && largo + frag.length > MAX_CARACTERES_LOTE) { lotes.push(actual); actual = []; largo = 0; }
    actual.push({ i, frag });
    largo += frag.length + 1;
  });
  if (actual.length) lotes.push(actual);
  return lotes;
}

function aceptados(ev, cliente, n) {
  ev.recibidos += n;
  ev.porCliente.set(cliente, (ev.porCliente.get(cliente) || 0) + n);
}

async function intentarLote(lote, destino, salida, ev) {
  try {
    const r = await traducirTextoConProcedencia(lote.map(x => x.frag).join('\n'), destino);
    const lineas = r.texto.split('\n');
    if (lineas.length !== lote.length) return false;
    lote.forEach((x, k) => { salida[x.i] = lineas[k]; });
    aceptados(ev, r.cliente, lote.length);
    return true;
  } catch (err) {

    if (/limitando/.test(err.message)) throw err;
    ev.errores.push(err.message);
    return false;
  }
}

async function rehacerUnoAUno(lote, destino, salida, ev) {
  for (const x of lote) {
    try {
      const r = await traducirTextoConProcedencia(x.frag, destino);
      salida[x.i] = r.texto;
      ev.reintentados++;
      aceptados(ev, r.cliente, 1);
    } catch (err) {
      salida[x.i] = x.frag;
      ev.originales++;
      ev.errores.push(err.message);
    }
    await dormir(120);
  }
}

async function traducirFragmentos(fragmentos, destino, alProgresar) {
  const salida = new Array(fragmentos.length);
  const ev = { enviados: fragmentos.length, recibidos: 0, reintentados: 0, originales: 0, errores: [], porCliente: new Map() };

  const limpios = fragmentos.map(f => f.replace(/\s*\n\s*/g, ' '));

  let hechos = 0;
  for (const lote of armarLotes(limpios)) {
    if (!await intentarLote(lote, destino, salida, ev)) await rehacerUnoAUno(lote, destino, salida, ev);
    hechos += lote.length;
    if (alProgresar) alProgresar({ hechos, total: fragmentos.length });
    await dormir(180);
  }

  const evidencia = { enviados: ev.enviados, recibidos: ev.recibidos, reintentados: ev.reintentados, originales: ev.originales,
    errores: [...new Set(ev.errores)].slice(0, 10),
    clientes: [...ev.porCliente].map(([id, fragmentos]) => ({ id, fragmentos })) };
  return Object.assign(salida.map((s, i) => (s == null ? fragmentos[i] : s)), { fallidos: ev.originales, evidencia });
}

function comprobarCompleta(traducidos) {
  const total = traducidos.length, fallidos = traducidos.fallidos || 0;
  if (fallidos > Math.max(2, Math.ceil(total * 0.05))) {
    throw new Error(`La traducción se cortó: ${fallidos} de ${total} párrafos no se pudieron traducir. No se ha guardado; vuelve a intentarlo en un rato.`);
  }
}

module.exports = { traducirFragmentos, comprobarCompleta, MAX_CARACTERES_LOTE };
