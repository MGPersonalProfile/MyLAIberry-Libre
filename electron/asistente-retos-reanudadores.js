const crypto = require('node:crypto');
const { limpiarUrl } = require('./asistente-retos-almacen.js');

const LARGO_RESULTADO = 20000;

function operacionDe(tipo, { requestId, url, ...resto }) {
  const limpia = limpiarUrl(url);
  const id = crypto.createHash('sha256').update(`${tipo}\n${requestId}\n${limpia}`).digest('hex').slice(0, 32);
  return { id, tipo, args: { url: limpia, ...resto } };
}

const resumenDe = (lectura, url) => ({ titulo: String(lectura?.titulo || '').slice(0, 300), url: String(lectura?.url || url),
  texto: String(lectura?.texto || '').slice(0, LARGO_RESULTADO) });

function crearReanudadores(definiciones = {}) {
  const tipos = new Map(Object.entries(definiciones));
  const admite = tipo => typeof tipo === 'string' && tipos.has(tipo);

  function validar(operacion) {
    if (!operacion || typeof operacion !== 'object') return { ok: false, motivo: 'sin descriptor' };
    if (!admite(operacion.tipo)) return { ok: false, motivo: `tipo de operación desconocido (${String(operacion.tipo).slice(0, 40)})` };
    if (!/^[0-9a-f]{32}$/.test(String(operacion.id))) return { ok: false, motivo: 'identificador de operación no válido' };
    try { tipos.get(operacion.tipo).validar(operacion.args || {}); } catch (e) { return { ok: false, motivo: e.message }; }
    return { ok: true };
  }
  const exigir = operacion => { const v = validar(operacion); if (!v.ok) throw Object.assign(new Error(`No se puede recuperar: ${v.motivo}.`), { codigo: 'incompatible' }); };

  async function ejecutar(operacion, ctx = {}) { exigir(operacion); return tipos.get(operacion.tipo).ejecutar(operacion.args, ctx); }
  async function reabrir(operacion, ctx = {}) { exigir(operacion); return tipos.get(operacion.tipo).reabrir(operacion.args, ctx); }

  return { admite, validar, ejecutar, reabrir, tipos: () => [...tipos.keys()] };
}

function lecturaWeb({ crearWebLibre, opciones = {} }) {
  const { comprobarForma } = require('./asistente-web-libre.js');
  const leerCon = async (web, url) => {
    try { return { ok: true, resultado: resumenDe(await web.leer(url), url) }; }
    catch (e) { if (e.reto) return { ok: false, motivo: 'comprobacion-humana' }; throw e; }
    finally { web.cerrar(); }
  };
  return {
    validar: ({ url }) => { if (!url) throw new Error('sin dirección'); comprobarForma(url); },
    ejecutar: ({ url }) => leerCon(crearWebLibre({ ...opciones, esperaReto: 8000, esperaRetoVisible: 0, mostrarVentana: false }), url),

    reabrir: ({ url }, { gestor, requestId, origen, hastaMs }) => leerCon(crearWebLibre({ ...opciones, mostrarVentana: origen === 'local',
      retos: { gestor, requestId, origen, esperaDirectorMs: hastaMs } }), url)
  };
}

function lecturaInvestigacion({ crearNavegador, opciones = {} }) {
  const { permitido } = require('./asistente-navegador.js');
  const { LECTOR } = require('./asistente-web-libre.js');
  const leerCon = async (navegador, url) => {
    try {
      await navegador.abrir(url);
      return { ok: true, resultado: resumenDe(await navegador.ejecutar(LECTOR), url) };
    } catch (e) { if (e.reto) return { ok: false, motivo: 'comprobacion-humana' }; throw e; }
    finally { navegador.cerrar(); }
  };
  return {
    validar: ({ url }) => { if (!url) throw new Error('sin dirección'); permitido(url, opciones.sitios); },
    ejecutar: ({ url }, { origen } = {}) => leerCon(crearNavegador({ ...opciones, origen, pendientes: null }), url),
    reabrir: ({ url }, { gestor, requestId, origen, hastaMs }) => leerCon(crearNavegador({ ...opciones, origen,
      pendientes: { gestor, requestId, esperaDirectorMs: hastaMs } }), url)
  };
}

function reanudadoresDeLaApp() {
  return crearReanudadores({
    'web.leer.v1': lecturaWeb({ crearWebLibre: o => require('./asistente-web-libre.js').crearWebLibre(o) }),
    'investigacion.leer.v1': lecturaInvestigacion({ crearNavegador: o => require('./asistente-navegador.js').crearNavegador(o) })
  });
}

module.exports = { crearReanudadores, operacionDe, lecturaWeb, lecturaInvestigacion, reanudadoresDeLaApp, LARGO_RESULTADO };
