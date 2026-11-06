const MIN = 60_000;
const DIA_MS = 24 * 60 * MIN;
const ordinal = dia => Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)) / DIA_MS;
const sesionesDe = mem => (mem && Array.isArray(mem.sesiones) ? mem.sesiones : []);

function rachas(dias, hoy) {
  const orden = [...new Set(dias)].sort().map(ordinal);
  let mejor = 0, corrida = 0;
  orden.forEach((o, i) => { corrida = i && o === orden[i - 1] + 1 ? corrida + 1 : 1; mejor = Math.max(mejor, corrida); });
  const ultimo = orden[orden.length - 1];
  const viva = orden.length > 0 && ultimo >= ordinal(hoy) - 1 && ultimo <= ordinal(hoy);
  return { rachaActual: viva ? corrida : 0, mejorRacha: mejor };
}

function estadisticas(mem, hoy) {
  const lista = sesionesDe(mem);
  const calendario = {}, diasPorObra = {};
  let minutosHoy = 0, minutos7 = 0, msTotal = 0, palabrasUnicas = 0, capitulosTerminados = 0;
  const h = ordinal(hoy);
  for (const s of lista) {
    const min = s.msActivos / MIN, o = ordinal(s.dia);
    calendario[s.dia] = Math.round(((calendario[s.dia] || 0) + min) * 100) / 100;
    (diasPorObra[s.obraId] ||= new Set()).add(s.dia);
    msTotal += s.msActivos;
    if (s.dia === hoy) minutosHoy += min;
    if (o <= h && o > h - 7) minutos7 += min;
    palabrasUnicas += s.palabrasNuevas || 0;
    if (s.capituloNuevo) capitulosTerminados++;
  }
  const redondo = n => Math.round(n * 100) / 100;
  return { ...rachas(lista.map(s => s.dia), hoy), minutosHoy: redondo(minutosHoy), minutos7: redondo(minutos7),
    minutosTotal: redondo(msTotal / MIN), sesiones: lista.length, capitulosTerminados, palabrasUnicas,
    obrasRetomadas: Object.values(diasPorObra).filter(d => d.size >= 2).length, calendario };
}

const CAMPOS = ['sessionId', 'deviceId', 'obraId', 'chapterId', 'inicio', 'fin', 'msActivos', 'zonaHoraria', 'dia',
  'palabrasNuevas', 'capituloNuevo', 'recibidaEn'];
const soloCampos = s => Object.fromEntries(CAMPOS.map(c => [c, s[c]]));

const exportarJSON = mem => ({ v: 1, sesiones: sesionesDe(mem).map(soloCampos) });
const desdeExportacion = json => ({ v: 1, sesiones: Array.isArray(json?.sesiones) ? json.sesiones.map(soloCampos) : [] });

const celda = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
function exportarCSV(mem) {
  return [CAMPOS.join(','), ...sesionesDe(mem).map(s => CAMPOS.map(c => celda(s[c])).join(','))].join('\n') + '\n';
}

module.exports = { estadisticas, exportarJSON, exportarCSV, desdeExportacion };
