const { enSeriePorObra } = require('./revisiones.js');
const { MAXIMO_RAZONABLE_MS, MINIMO_RAZONABLE_MS, PPM_MAXIMO } = require('../ritmo.js');

const ID = /^[\w-]{8,80}$/;
const ID_APARATO = /^[\w-]{1,80}$/;
const ID_OBRA = /^[A-Za-z0-9_-]{1,64}$/;
const fraccion = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const entero = n => Number.isInteger(n) && n >= 0;

function diaCivil(ms, zona) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

function zonaValida(z) {
  if (typeof z !== 'string' || z.length > 60) return false;
  try { diaCivil(0, z); return true; } catch { return false; }
}

function sesionValida(s, ahora = Date.now()) {
  if (!s || typeof s !== 'object' || !ID.test(String(s.sessionId)) || !ID_APARATO.test(String(s.deviceId))) return null;
  if (!ID_OBRA.test(String(s.obraId)) || !entero(s.chapterId) || s.chapterId > 100000) return null;
  if (!entero(s.inicio) || !entero(s.fin) || s.fin <= s.inicio || s.fin > ahora + 60_000 || s.inicio < 1_600_000_000_000) return null;
  if (!entero(s.msActivos) || s.msActivos < MINIMO_RAZONABLE_MS || s.msActivos > MAXIMO_RAZONABLE_MS
    || s.msActivos > s.fin - s.inicio + 1000) return null;
  if (!zonaValida(s.zonaHoraria)) return null;
  const lista = Array.isArray(s.tramos) ? s.tramos : s.tramo ? [s.tramo] : [];
  if (lista.length > 50 || !lista.every(t => t && fraccion(t.desde) && fraccion(t.hasta) && t.hasta >= t.desde)) return null;
  return { sessionId: s.sessionId, deviceId: s.deviceId, obraId: s.obraId, chapterId: s.chapterId, inicio: s.inicio,
    fin: s.fin, msActivos: s.msActivos, zonaHoraria: s.zonaHoraria, tramos: lista.map(t => ({ desde: t.desde, hasta: t.hasta })),
    terminado: s.terminado === true };
}

function unirIntervalos(lista) {
  const orden = lista.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const unidos = [];
  for (const [a, b] of orden) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b); else unidos.push([a, b]);
  }
  return unidos;
}
const total = lista => lista.reduce((n, [a, b]) => n + (b - a), 0);

function cubrir(cobertura, intervalo) {
  const unidos = unirIntervalos([...cobertura, intervalo]);
  return { cobertura: unidos, nuevas: total(unidos) - total(cobertura) };
}

function memoriaDe(datos) {
  datos.memoriaLectura ||= { v: 1, sesiones: [], cobertura: {}, terminados: {} };
  return datos.memoriaLectura;
}

function palabrasNuevas(mem, v, capitulo) {
  if (!v.tramos.length || !capitulo?.palabras) return 0;

  const leidos = unirIntervalos(v.tramos.map(t => [Math.round(t.desde * capitulo.palabras), Math.round(t.hasta * capitulo.palabras)]));
  if (total(leidos) / (v.msActivos / 60000) > PPM_MAXIMO) return 0;
  const clave = `${v.obraId}:${v.chapterId}:${capitulo.huella}`;
  let cobertura = mem.cobertura[clave] || [], nuevas = 0;
  for (const intervalo of leidos) { const r = cubrir(cobertura, intervalo); cobertura = r.cobertura; nuevas += r.nuevas; }
  mem.cobertura[clave] = cobertura;
  return nuevas;
}

function registrarSesion(almacen, sesion, capitulo, ahora = Date.now()) {
  const v = sesionValida(sesion, ahora);
  if (!v) return Promise.resolve({ aceptada: false, motivo: 'no-valida' });
  return enSeriePorObra('memoria-lectura', async () => {
    const datos = await almacen.leer();
    const mem = memoriaDe(datos);
    const previa = mem.sesiones.find(x => x.sessionId === v.sessionId);
    if (previa) return { aceptada: true, duplicada: true, recibidaEn: previa.recibidaEn };
    const info = await capitulo(v.obraId, v.chapterId);
    const claveCap = `${v.obraId}:${v.chapterId}`;
    const capituloNuevo = v.terminado && !mem.terminados[claveCap];
    if (v.terminado) mem.terminados[claveCap] = 1;
    const registro = { sessionId: v.sessionId, deviceId: v.deviceId, obraId: v.obraId, chapterId: v.chapterId,
      inicio: v.inicio, fin: v.fin, msActivos: v.msActivos, zonaHoraria: v.zonaHoraria,
      dia: diaCivil(v.inicio, v.zonaHoraria), palabrasNuevas: palabrasNuevas(mem, v, info), capituloNuevo,
      recibidaEn: new Date(ahora).toISOString() };
    mem.sesiones.push(registro);
    await almacen.guardar();
    return { aceptada: true, duplicada: false, recibidaEn: registro.recibidaEn };
  });
}

module.exports = { registrarSesion, sesionValida, unirIntervalos, cubrir, diaCivil, memoriaDe };
