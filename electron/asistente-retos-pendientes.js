const crypto = require('node:crypto');

const TTL_MS = 30 * 60 * 1000;
const CANAL = 'asistente-reto-pendiente';

function crearGestor({ ahora = Date.now, ttlMs = TTL_MS, avisar = () => {}, nuevoId = () => crypto.randomUUID() } = {}) {
  const retos = new Map();

  const INTERVENIBLES = ['esperando-persona', 'no-resuelto'];
  const ventanaViva = r => { try { const w = r.ventana?.(); return !!w && !w.isDestroyed(); } catch { return false; } };
  const vista = ({ reanudarOperacion, token, enCurso, ventana, limpiezas, ...publico }) => ({ ...publico, reanudable: !!reanudarOperacion,
    remoto: INTERVENIBLES.includes(publico.estado) && ventanaViva({ ventana }), intervencion: publico.intervencion || 'inactiva' });

  function liberar(r) {
    const pendientes = r.limpiezas || [];
    r.limpiezas = [];
    for (const f of pendientes) { try { f(); } catch {  } }
  }
  function caducar() {
    for (const r of retos.values()) {
      if (ahora() >= r.caducaEn && !['reanudado', 'cancelado', 'caducado'].includes(r.estado)) { r.estado = 'caducado'; liberar(r); }
    }
  }

  const anunciar = r => avisar(CANAL, { ...vista(r), token: r.token });
  const vivos = () => { caducar(); return [...retos.values()].filter(r => r.estado !== 'caducado'); };

  function registrar({ requestId, sitio, url, origen, reanudar, ventana }) {
    const existente = vivos().find(r => r.requestId === requestId && r.sitio === sitio && ['esperando-persona', 'comprobando', 'no-resuelto'].includes(r.estado));
    if (existente) { if (ventana) existente.ventana = ventana; return vista(existente); }
    const creadoEn = ahora();
    const reto = { id: nuevoId(), requestId, sitio, url, estado: 'esperando-persona', origen, creadoEn, caducaEn: creadoEn + ttlMs,
      reanudarOperacion: reanudar, ventana, limpiezas: [], intervencion: 'inactiva', token: crypto.randomBytes(18).toString('base64url') };
    retos.set(reto.id, reto);
    anunciar(reto);
    return vista(reto);
  }

  function autorizar(reto, { local = false, token } = {}) {
    if (local) return;
    const bueno = typeof token === 'string' && !!reto.token && token.length === reto.token.length
      && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(reto.token));
    if (bueno) return;
    throw Object.assign(new Error('No estás autorizado para este reto.'), { noAutorizado: true, codigo: 'no-autorizado' });
  }
  const buscar = id => { const r = retos.get(id); if (!r) throw new Error('Ese reto no existe.'); return r; };

  function cancelar(id, autorizacion) {
    const reto = buscar(id);
    autorizar(reto, autorizacion);
    if (!['esperando-persona', 'comprobando'].includes(reto.estado)) return vista(reto);
    reto.estado = 'cancelado';
    liberar(reto);
    anunciar(reto);
    return vista(reto);
  }

  async function reanudar(id, autorizacion) {
    const reto = buscar(id);
    autorizar(reto, autorizacion);
    caducar();
    if (reto.estado === 'comprobando') return reto.enCurso;
    if (reto.estado === 'reanudado') return vista(reto);
    if (!['esperando-persona', 'no-resuelto'].includes(reto.estado)) throw new Error(`El reto está ${reto.estado}: no se puede reanudar.`);
    reto.estado = 'comprobando';
    reto.mensaje = '';
    liberar(reto);
    anunciar(reto);
    reto.enCurso = (async () => {
      let r, fallo;
      try { r = await reto.reanudarOperacion(); } catch (e) { fallo = e; }
      reto.enCurso = null;
      caducar();
      if (reto.estado !== 'comprobando') return vista(reto);
      if (fallo) { reto.estado = 'no-resuelto'; reto.mensaje = `No se pudo comprobar: ${fallo.message}`; } else {
        reto.estado = r?.ok ? 'reanudado' : 'esperando-persona';
        reto.mensaje = r?.ok ? 'El sitio vuelve a responder.' : 'Sigue pidiendo la comprobación: pásala en el navegador y vuelve a intentarlo.';
      }
      if (reto.estado === 'reanudado') liberar(reto);
      anunciar(reto);
      return vista(reto);
    })();
    return reto.enCurso;
  }

  const coded = (mensaje, codigo) => Object.assign(new Error(mensaje), { codigo });

  function paraRemoto(id, autorizacion) {
    const reto = retos.get(id);
    if (!reto) throw coded('Ese reto no existe.', 'sin-reto');
    autorizar(reto, autorizacion);
    caducar();
    if (reto.estado === 'caducado') throw coded('El reto caducó.', 'caducado');
    if (!INTERVENIBLES.includes(reto.estado)) throw coded('Este reto ya no admite intervención.', 'sin-sesion');
    const ventana = reto.ventana?.();
    if (!ventana || ventana.isDestroyed()) throw coded('La ventana de este reto ya no existe.', 'ventana-destruida');
    return { reto: vista(reto), ventana, caducaEn: reto.caducaEn, ventanaDe: reto.ventana };
  }

  function alCerrar(id, limpieza) {
    const reto = retos.get(id);
    if (!reto) { limpieza(); return; }
    (reto.limpiezas ||= []).push(limpieza);
  }

  function marcarIntervencion(id, activa) {
    const reto = retos.get(id);
    if (!reto || (reto.intervencion === 'activa') === !!activa) return;
    reto.intervencion = activa ? 'activa' : 'inactiva';
    anunciar(reto);
  }

  function soltar(id) {
    const reto = retos.get(id);
    if (!reto) return;
    reto.intervencion = 'inactiva';
    liberar(reto);
  }

  function resolver(id, { continua = false } = {}) {
    const reto = retos.get(id);
    if (!reto) return null;
    caducar();
    if (['esperando-persona', 'comprobando', 'no-resuelto'].includes(reto.estado)) {
      reto.estado = 'reanudado';
      reto.continua = continua;
      reto.mensaje = 'El sitio vuelve a responder.';
      reto.intervencion = 'inactiva';
      liberar(reto);
      anunciar(reto);
    }
    return vista(reto);
  }

  async function esperarDirector(id, { hayReto, signal, hastaMs, paso = 1000, dormir = ms => new Promise(r => setTimeout(r, ms)) }) {
    const limite = ahora() + hastaMs;
    let limpias = 0;
    for (;;) {
      const reto = retos.get(id);
      caducar();
      if (!reto || reto.estado === 'cancelado') return 'cancelado';
      if (reto.estado === 'caducado') return 'caducado';
      if (reto.estado === 'reanudado') return 'resuelto';
      if (signal?.aborted) return 'abortado';
      if (ahora() >= limite) return 'agotado';
      let hay;
      try { hay = await hayReto(); } catch { soltar(id); return 'agotado'; }
      limpias = hay ? 0 : limpias + 1;
      if (limpias >= 2) { resolver(id, { continua: true }); return 'resuelto'; }
      await dormir(paso);
    }
  }

  const listar = ({ conToken = false } = {}) => vivos().map(r => (conToken ? { ...vista(r), token: r.token } : vista(r)));
  return { registrar, cancelar, reanudar, listar, paraRemoto, alCerrar, marcarIntervencion, resolver, soltar, esperarDirector };
}

module.exports = { crearGestor, TTL_MS, CANAL };
