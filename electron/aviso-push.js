const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AGRUPAR_MS = 90000;
const MAX_REINTENTO = 60 * 60 * 1000;
const idDe = endpoint => crypto.createHash('sha256').update(endpoint).digest('hex');
const vacio = () => ({ vapid: null, suscripciones: {}, lote: null, entregas: [], vistos: {} });

function crearEmisor({ dir, transporte, cifrado, reloj = Date.now, programar = setTimeout, agruparMs = AGRUPAR_MS } = {}) {
  const archivo = path.join(dir || require('./db.js').raizActual(), 'push-capitulos.json');
  const webPush = transporte || require('web-push');
  const clave = cifrado || require('./clave.js');
  let estado;
  let cola = Promise.resolve();
  let timer;
  const cargar = () => {
    if (!estado) {
      try { estado = { ...vacio(), ...JSON.parse(fs.readFileSync(archivo, 'utf8')) }; }
      catch (e) { if (e.code !== 'ENOENT') throw e; estado = vacio(); }
    }
    return estado;
  };
  const guardar = () => {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    const temporal = `${archivo}.${process.pid}.tmp`;
    fs.writeFileSync(temporal, JSON.stringify(estado), { mode: 0o600 });
    fs.renameSync(temporal, archivo);
  };
  const serial = fn => {
    const siguiente = cola.then(fn, fn);
    cola = siguiente.catch(() => {});
    return siguiente;
  };
  const agendar = () => {
    if (timer) clearTimeout(timer);
    const s = cargar();
    const fechas = [s.lote?.hasta, ...s.entregas.map(e => e.siguiente)].filter(Number.isFinite);
    if (!fechas.length) return;
    timer = programar(() => { timer = null; entregarPendiente({ forzarLote: false }).catch(e => console.warn('[Push] No se pudo enviar:', e.message)); },
      Math.max(0, Math.min(...fechas) - reloj()));
    timer?.unref?.();
  };
  const clavePublica = () => serial(() => {
    const s = cargar();
    if (!s.vapid) {
      const par = webPush.generateVAPIDKeys();
      const privada = clave.paraGuardar(par.privateKey);
      if (!clave.estaCifrada(privada)) throw new Error('No hay cifrado de sistema para guardar VAPID');
      s.vapid = { publicKey: par.publicKey, privateKey: privada };
      guardar();
    }
    return s.vapid.publicKey;
  });
  const suscribir = sub => serial(() => {
    const s = cargar();
    if (!/^https:\/\//.test(sub?.endpoint || '') || !sub?.keys?.p256dh || !sub?.keys?.auth || sub.endpoint.length > 2048) {
      throw new Error('Suscripción push no válida');
    }
    const id = idDe(sub.endpoint);
    s.suscripciones[id] = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      alta: s.suscripciones[id]?.alta ?? reloj() };
    guardar();
    return { id };
  });
  const cancelar = endpoint => serial(() => {
    const s = cargar();
    if (typeof endpoint !== 'string') throw new Error('Endpoint no válido');
    const id = idDe(endpoint);
    delete s.suscripciones[id];
    s.entregas = s.entregas.filter(e => e.suscripcion !== id);
    guardar();
    agendar();
    return { borrada: true };
  });
  const novedad = ({ id, titulo, capitulos }) => serial(() => {
    const s = cargar();
    if (!id || !Array.isArray(capitulos) || !capitulos.length) return false;
    let cambio = false;
    if (!s.lote && Object.keys(s.suscripciones).length) {
      s.lote = { id: crypto.randomUUID(), desde: reloj(), hasta: reloj() + agruparMs, obras: {} };
    }
    for (const capitulo of capitulos) {
      const identidad = idDe(`${id}\0${capitulo}`);
      if (Object.hasOwn(s.vistos, identidad)) continue;
      s.vistos[identidad] = reloj();
      if (s.lote) {
        const claveObra = idDe(String(id));
        const obra = s.lote.obras[claveObra] ||= { id: String(id), titulo: String(titulo || 'Una obra tuya').slice(0, 160), capitulos: [] };
        obra.capitulos.push(String(capitulo));
      }
      cambio = true;
    }
    if (!cambio && s.lote && !Object.keys(s.lote.obras).length) s.lote = null;
    if (cambio) {
      if (s.lote) s.lote.hasta = reloj() + agruparMs;

      const claves = Object.keys(s.vistos);
      if (claves.length > 20000) for (const k of claves.sort((a, b) => s.vistos[a] - s.vistos[b]).slice(0, claves.length - 10000)) delete s.vistos[k];
      guardar();
      agendar();
    }
    return cambio;
  });
  const entregarPendiente = ({ forzarLote = true } = {}) => serial(async () => {
    const s = cargar();
    if (s.lote && (forzarLote || s.lote.hasta <= reloj())) {
      const obras = Object.values(s.lote.obras);
      if (obras.length) {
        const titulo = obras.length === 1 ? obras[0].titulo : `${obras.length} obras tienen capítulos nuevos`;
        const total = obras.reduce((n, o) => n + o.capitulos.length, 0);
        const body = obras.length === 1 ? `Hay ${total} capítulo${total === 1 ? '' : 's'} nuevo${total === 1 ? '' : 's'} de ${titulo}` : `${total} capítulos nuevos`;
        const payload = { id: s.lote.id, title: titulo, body, obraId: obras.length === 1 ? obras[0].id : null };
        for (const [id, sub] of Object.entries(s.suscripciones)) {
          if ((sub.alta ?? -1) <= (s.lote.desde ?? reloj())) {
            s.entregas.push({ id: s.lote.id, suscripcion: id, payload, intentos: 0, siguiente: reloj() });
          }
        }
      }
      s.lote = null;
      guardar();
    }
    for (const entrega of [...s.entregas]) {
      if (entrega.siguiente > reloj()) continue;
      const sub = s.suscripciones[entrega.suscripcion];
      if (!sub) { s.entregas = s.entregas.filter(e => e !== entrega); guardar(); continue; }
      const privada = clave.paraUsar(s.vapid?.privateKey);
      if (!privada) throw new Error('La clave VAPID guardada no se puede abrir');
      webPush.setVapidDetails('mailto:avisos@mylaiberry.local', s.vapid.publicKey, privada);
      try {
        const respuesta = await webPush.sendNotification(sub, JSON.stringify(entrega.payload), { TTL: 86400 });
        if (respuesta?.statusCode && (respuesta.statusCode < 200 || respuesta.statusCode >= 300)) {
          throw Object.assign(new Error('Rechazo del servicio push'), { statusCode: respuesta.statusCode });
        }
        s.entregas = s.entregas.filter(e => e !== entrega);
      } catch (e) {
        if ([404, 410].includes(e.statusCode)) {
          delete s.suscripciones[entrega.suscripcion];
          s.entregas = s.entregas.filter(d => d.suscripcion !== entrega.suscripcion);
        } else {
          entrega.intentos++;
          entrega.siguiente = reloj() + Math.min(MAX_REINTENTO, 30000 * 2 ** Math.min(entrega.intentos - 1, 7));
        }
      }
      guardar();
    }
    agendar();
  });
  const estadoPublico = () => serial(() => ({ suscripciones: Object.keys(cargar().suscripciones).length,
    pendientes: cargar().entregas.length, clavePublica: cargar().vapid?.publicKey || null }));
  const estaSuscrito = endpoint => serial(() => typeof endpoint === 'string' && !!cargar().suscripciones[idDe(endpoint)]);
  const iniciar = () => { cargar(); agendar(); };
  const detener = () => { if (timer) clearTimeout(timer); timer = null; };
  return { clavePublica, suscribir, cancelar, estaSuscrito, novedad, entregarPendiente, estado: estadoPublico, iniciar, detener };
}

let emisor;
let raizEmisor;
function actual() {
  const raiz = require('./db.js').raizActual();
  if (raizEmisor !== raiz) {
    emisor?.detener();
    emisor = crearEmisor({ dir: raiz });
    raizEmisor = raiz;
    emisor.iniciar();
  }
  return emisor;
}
module.exports = { crearEmisor, actual, AGRUPAR_MS };
