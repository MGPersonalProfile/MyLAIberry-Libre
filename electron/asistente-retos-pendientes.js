const crypto = require('node:crypto');

const TTL_MS = 30 * 60 * 1000;
const CANAL = 'asistente-reto-pendiente';
const MAX_FALLOS = 5;

function crearGestor({ ahora = Date.now, ttlMs = TTL_MS, avisar = () => {}, nuevoId = () => crypto.randomUUID() } = {}) {
  const retos = new Map();

  const vista = ({ reanudarOperacion, token, intentosFallidos, enCurso, ...publico }) => ({ ...publico, reanudable: !!reanudarOperacion });
  function caducar() {
    for (const r of retos.values()) {
      if (ahora() >= r.caducaEn && !['reanudado', 'cancelado', 'caducado'].includes(r.estado)) r.estado = 'caducado';
    }
  }

  const anunciar = r => avisar(CANAL, { ...vista(r), token: r.token });
  const vivos = () => { caducar(); return [...retos.values()].filter(r => r.estado !== 'caducado'); };

  function registrar({ requestId, sitio, url, origen, reanudar }) {
    const existente = vivos().find(r => r.requestId === requestId && r.sitio === sitio && ['esperando-persona', 'comprobando'].includes(r.estado));
    if (existente) return vista(existente);
    const creadoEn = ahora();
    const reto = { id: nuevoId(), requestId, sitio, url, estado: 'esperando-persona', origen, creadoEn, caducaEn: creadoEn + ttlMs,
      reanudarOperacion: reanudar, token: crypto.randomBytes(18).toString('base64url'), intentosFallidos: 0 };
    retos.set(reto.id, reto);
    anunciar(reto);
    return vista(reto);
  }

  function autorizar(reto, { local = false, token } = {}) {
    if (local) return;
    const bueno = typeof token === 'string' && !!reto.token && token.length === reto.token.length
      && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(reto.token));
    if (bueno) return;
    if (++reto.intentosFallidos >= MAX_FALLOS) reto.token = null;
    throw Object.assign(new Error(reto.token ? 'No estás autorizado para este reto.' : 'Reto sin autorización: revocado, sólo desde el PC.'), { noAutorizado: true });
  }
  const buscar = id => { const r = retos.get(id); if (!r) throw new Error('Ese reto no existe.'); return r; };

  function cancelar(id, autorizacion) {
    const reto = buscar(id);
    autorizar(reto, autorizacion);
    if (!['esperando-persona', 'comprobando'].includes(reto.estado)) return vista(reto);
    reto.estado = 'cancelado';
    anunciar(reto);
    return vista(reto);
  }

  async function reanudar(id, autorizacion) {
    const reto = buscar(id);
    autorizar(reto, autorizacion);
    caducar();
    if (reto.estado === 'comprobando') return reto.enCurso;
    if (reto.estado === 'reanudado') return vista(reto);
    if (reto.estado !== 'esperando-persona') throw new Error(`El reto está ${reto.estado}: no se puede reanudar.`);
    reto.estado = 'comprobando';
    reto.mensaje = '';
    anunciar(reto);
    reto.enCurso = (async () => {
      try {
        const r = await reto.reanudarOperacion();
        reto.estado = r?.ok ? 'reanudado' : 'esperando-persona';
        reto.mensaje = r?.ok ? 'El sitio vuelve a responder.' : 'Sigue pidiendo la comprobación: pásala en el navegador y vuelve a intentarlo.';
      } catch (e) { reto.estado = 'no-resuelto'; reto.mensaje = `No se pudo comprobar: ${e.message}`; }
      reto.enCurso = null;
      anunciar(reto);
      return vista(reto);
    })();
    return reto.enCurso;
  }

  const listar = ({ conToken = false } = {}) => vivos().map(r => (conToken ? { ...vista(r), token: r.token } : vista(r)));
  return { registrar, cancelar, reanudar, listar };
}

module.exports = { crearGestor, TTL_MS, CANAL };
