const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { limpiarHtml } = require('./limpiar-html.js');

function esIPv4Privada(ip) {
  const trozos = String(ip || '').split('.');
  if (trozos.length !== 4) return false;
  const n = trozos.map(Number);
  if (n.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  if (n[0] === 10) return true;
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;
  if (n[0] === 192 && n[1] === 168) return true;
  return false;
}

function esLoopback(ip) {
  const limpia = String(ip || '').replace(/^::ffff:/i, '');
  return limpia === '::1' || limpia.split('.')[0] === '127';
}

function direccionesLan() {
  const encontradas = [];
  const interfaces = os.networkInterfaces();
  for (const [nombre, entradas] of Object.entries(interfaces)) {
    for (const e of entradas || []) {

      const esV4 = e.family === 'IPv4' || e.family === 4;
      if (!esV4 || e.internal) continue;
      if (!esIPv4Privada(e.address)) continue;
      encontradas.push({ interfaz: nombre, direccion: e.address });
    }
  }
  return encontradas;
}

const { rutaSegura, esIdValido, esIndiceValido } = require('./lan/rutas-seguras.js');
const { fuenteDeDisco } = require('./lan/fuente-de-disco.js');

const {
  escaparHtml, limpiarCapitulo, paginaBiblioteca, paginaObra, paginaCapitulo, CSS
} = require('./lan/paginas.js');
const { piezaDeLaApp } = require('./lan/pwa.js');
const { atenderProgreso, drenar } = require('./lan/progreso.js');
const { atenderApp } = require('./lan/app-web.js');

const PUERTO_POR_DEFECTO = 8787;

let enMarcha = null;

function responder(res, codigo, tipo, cuerpo, extra = {}) {
  res.writeHead(codigo, {
    'Content-Type': tipo,
    'Content-Length': Buffer.byteLength(cuerpo),

    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; " +
      "worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',

    'Cache-Control': 'no-store',
    ...extra
  });
  res.end(cuerpo);
}

function error(res, codigo, mensaje) {

  responder(res, codigo, 'text/plain; charset=utf-8', mensaje + '\n');
}

function segmento(texto) {
  let suelto;
  try {
    suelto = decodeURIComponent(texto);
  } catch {
    return null;
  }
  if (/[/\\\0]/.test(suelto)) return null;
  return suelto;
}

function rechazo(req, anfitrionesValidos) {

  if (req.method !== 'GET' && req.method !== 'POST') return [405, 'Sólo GET.'];

  const origen = (req.socket.remoteAddress || '').replace(/^::ffff:/i, '');
  if (!esLoopback(origen) && !esIPv4Privada(origen)) return [403, 'Sólo desde la red local.'];

  const anfitrion = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (!anfitrionesValidos.has(anfitrion)) return [403, 'Cabecera Host inesperada.'];

  return null;
}

function rutaDe(url, codigo) {
  const partes = [];
  for (const crudo of url.pathname.split('/').filter(Boolean)) {
    const s = segmento(crudo);
    if (s === null) return null;
    partes.push(s);
  }

  if (codigo) {
    if (partes[0] !== codigo) return null;
    partes.shift();
  }

  return partes;
}

async function servirBiblioteca(res, fuente, base) {
  const obras = await fuente.listarObras();
  const conPortada = await Promise.all(
    obras.map(async o => ({
      ...o,

      tienePortada: typeof fuente.tienePortada === 'function'
        ? await fuente.tienePortada(o.id)
        : !!(await fuente.leerPortada(o.id))
    }))
  );
  return responder(res, 200, 'text/html; charset=utf-8', paginaBiblioteca(conPortada, base));
}

async function servirObra(res, { fuente, base, partes, url }) {
  const id = partes[1];
  if (!esIdValido(id)) return error(res, 404, 'No hay nada aquí.');
  const obra = await fuente.obra(id);
  if (!obra) return error(res, 404, 'No hay nada aquí.');
  const capitulos = await fuente.capitulosDe(id);

  if (partes.length === 2) {
    return responder(res, 200, 'text/html; charset=utf-8', paginaObra(obra, capitulos, base));
  }

  if (partes[2] !== 'cap' || !esIndiceValido(partes[3])) {
    return error(res, 404, 'No hay nada aquí.');
  }
  const indice = Number(partes[3]);
  const enDisco = capitulos.find(c => c.indice === indice);
  if (!enDisco) return error(res, 404, 'No hay nada aquí.');

  const pedido = url.searchParams.get('idioma');
  const elegido = pedido === 'original' ? null
    : pedido || (typeof fuente.idiomaDeLectura === 'function' ? await fuente.idiomaDeLectura() : null);
  const idioma = elegido && enDisco.idiomas.includes(elegido) ? elegido : null;
  const consulta = pedido === 'original' || (pedido && idioma === pedido) ? pedido : null;

  const html = await fuente.leerCapitulo(id, indice, idioma);
  if (html === null) return error(res, 404, 'No hay nada aquí.');

  return responder(
    res,
    200,
    'text/html; charset=utf-8',
    paginaCapitulo({ obra, indice, html, idioma, consulta, idiomas: enDisco.idiomas, capitulos, base })
  );
}

async function atender(req, res, { fuente, base, codigo, anfitrionesValidos, app }) {
  const negado = rechazo(req, anfitrionesValidos);
  if (negado) return error(res, negado[0], negado[1]);

  let url;
  try {
    url = new URL(req.url, 'http://interno');
  } catch {
    return error(res, 400, 'Petición mal formada.');
  }

  const partes = rutaDe(url, codigo);
  if (partes === null) return error(res, 404, 'No hay nada aquí.');

  if (await atenderApp(req, res, partes, url, app)) return undefined;

  if (app && req.method === 'GET' && (partes.length === 0 || partes[0] === 'obra')) {
    res.writeHead(302, { Location: base + '/app/', 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (req.method === 'POST') {
    if (partes.length !== 1 || partes[0] !== 'progreso') return error(res, 405, 'Sólo GET.');
    const [estado, mensaje, revision] = await atenderProgreso(req, fuente.guardarProgreso);

    if (estado !== 204) {
      await drenar(req);
      if (revision) res.setHeader('X-Lectura-Revision', revision.revision);
      return error(res, estado, mensaje);
    }
    res.writeHead(204, { 'Cache-Control': 'no-store',
      ...(revision ? { 'X-Lectura-Revision': revision.revision } : {}) });
    return res.end();
  }

  if (partes.length === 0) return servirBiblioteca(res, fuente, base);

  if (partes.length === 1 && partes[0] === 'estilo.css') {
    return responder(res, 200, 'text/css; charset=utf-8', CSS);
  }

  const pieza = partes.length === 1 && piezaDeLaApp(partes[0], base);
  if (pieza) return responder(res, 200, pieza.tipo, pieza.cuerpo);

  if (partes[0] === 'portada' && partes.length === 2) {
    if (!esIdValido(partes[1])) return error(res, 404, 'No hay nada aquí.');
    const portada = await fuente.leerPortada(partes[1]);
    if (!portada) return error(res, 404, 'No hay nada aquí.');
    return responder(res, 200, portada.tipo, portada.datos);
  }

  if (partes[0] === 'obra' && (partes.length === 2 || partes.length === 4)) {
    return servirObra(res, { fuente, base, partes, url });
  }

  return error(res, 404, 'No hay nada aquí.');
}

function comprobarArranque(fuente, codigo) {
  if (enMarcha) throw new Error('El servidor de red local ya está encendido.');
  if (!fuente || typeof fuente.listarObras !== 'function') {
    throw new Error('Hace falta una fuente con listarObras(), obra(), capitulosDe(), leerCapitulo() y leerPortada().');
  }
  if (codigo !== null && !/^[A-Za-z0-9_-]{4,64}$/.test(String(codigo))) {
    throw new Error('El código de acceso sólo admite letras, números, guion y guion bajo (4-64).');
  }
}

function anfitrionesDe(objetivos) {
  return new Set(
    [...objetivos, 'localhost', '127.0.0.1', '[::1]', '::1', os.hostname(), os.hostname() + '.local']
      .map(h => String(h).toLowerCase())
  );
}

async function escucharEn(direccion, puerto, contexto, sockets) {
  const servidor = http.createServer((req, res) => {
    atender(req, res, contexto).catch(() => {

      if (!res.headersSent) error(res, 500, 'Algo ha ido mal.');
      else res.end();
    });
  });

  servidor.headersTimeout = 10_000;
  servidor.requestTimeout = 30_000;
  servidor.on('connection', c => {
    sockets.add(c);
    c.on('close', () => sockets.delete(c));
  });

  await new Promise((resolver, rechazar) => {
    const fallo = e => rechazar(
      e && e.code === 'EADDRINUSE'
        ? new Error('El puerto ' + puerto + ' ya está ocupado en ' + direccion + '.')
        : e
    );
    servidor.once('error', fallo);

    servidor.listen(puerto, direccion, 32, () => {
      servidor.off('error', fallo);
      resolver();
    });
  });

  return servidor;
}

async function arrancar({ puerto = PUERTO_POR_DEFECTO, fuente, direcciones, codigo = null, nombres = [], app = null } = {}) {
  comprobarArranque(fuente, codigo);

  const objetivos = (direcciones && direcciones.length ? direcciones : direccionesLan().map(d => d.direccion));
  if (!objetivos.length) {
    throw new Error('No hay ninguna red local a la que asomarse: ninguna interfaz tiene dirección privada.');
  }

  const base = codigo ? '/' + codigo : '';

  const contexto = { fuente, base, codigo, app: app && { ...app, codigoLan: !!codigo },
    anfitrionesValidos: anfitrionesDe([...objetivos, ...nombres]) };

  const servidores = [];
  const sockets = new Set();

  try {
    for (const direccion of objetivos) {
      servidores.push(await escucharEn(direccion, puerto, contexto, sockets));
    }
  } catch (e) {

    for (const s of servidores) s.close();
    for (const c of sockets) c.destroy();
    sockets.clear();
    throw e;
  }

  enMarcha = { servidores, sockets, puerto, base };

  const urls = objetivos.map(d => 'http://' + d + ':' + puerto + base + '/');
  return { puerto, urls, direcciones: objetivos.slice(), base };
}

async function parar() {
  if (!enMarcha) return { estaba: false };
  const { servidores, sockets } = enMarcha;
  enMarcha = null;

  await Promise.all(
    servidores.map(s => new Promise(resolver => {
      s.close(() => resolver());
      if (typeof s.closeAllConnections === 'function') s.closeAllConnections();
    }))
  );
  for (const c of sockets) c.destroy();
  sockets.clear();

  require('./lan/eventos.js').cerrarTodos();

  return { estaba: true };
}

function estado() {
  return enMarcha ? { encendido: true, puerto: enMarcha.puerto, base: enMarcha.base } : { encendido: false };
}

module.exports = {
  arrancar,
  parar,
  estado,
  fuenteDeDisco,

  rutaSegura,
  esIdValido,
  esIndiceValido,
  direccionesLan,
  esIPv4Privada,
  limpiarCapitulo,
  escaparHtml,
  PUERTO_POR_DEFECTO
};
