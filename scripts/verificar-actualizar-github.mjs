/** Banco sin red para el actualizador de la copia pública. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buscar, instalar, esMasNueva } = require('../electron/actualizar.js');
const repo = 'ejemplo/mylaiberry';
const version = '2026.10.31';
const nombre = `MyLAIberry-Setup-${version}.exe`;
const bytes = Buffer.from('Instalador ficticio para las pruebas');
const hash = crypto.createHash('sha512').update(bytes).digest('base64');
const api = `https://api.github.com/repos/${repo}/releases/latest`;
const exe = `https://github.com/${repo}/releases/download/v${version}/${nombre}`;
const ficha = `https://github.com/${repo}/releases/download/v${version}/latest.yml`;

function escenario({ tag = `v${version}`, sha512 = hash, size = bytes.length,
  assetSize = bytes.length, sinExe = false, sinFicha = false, redireccion = null,
  sinRed = false, respuestaExe = bytes } = {}) {
  const llamadas = [];
  const assets = [
    ...sinExe ? [] : [{ name: nombre, size: assetSize, browser_download_url: exe }],
    ...sinFicha ? [] : [{ name: 'latest.yml', size: 100, browser_download_url: ficha }]
  ];
  const release = { tag_name: tag, assets };
  const manifest = `version: ${version}\nfiles:\n  - url: ${nombre}\n    sha512: ${sha512}\n    size: ${size}\npath: ${nombre}\n`;
  const fetchImpl = async (url, opciones) => {
    llamadas.push({ url, opciones });
    if (sinRed) throw new Error('GitHub caído');
    if (url === api) return new Response(JSON.stringify(release));
    if (url === ficha) return new Response(manifest);
    if (url === exe && redireccion) return new Response(null, { status: 302, headers: { location: redireccion } });
    if (url === exe) return respuestaExe?.body ? respuestaExe : new Response(respuestaExe);
    if (url === redireccion) return new Response(respuestaExe);
    throw new Error(`Destino inesperado: ${url}`);
  };
  return { fetchImpl, llamadas };
}

async function intento(opciones = {}) {
  const { fetchImpl, llamadas } = escenario(opciones);
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'mylaiberry-banco-'));
  let orden = null;
  try {
    const resultado = await instalar({ actual: '2026.10.30', repositorio: repo, fetchImpl,
      directorioTemporal: carpeta, lanzar: async (ruta, args) => { orden = { ruta, args, bytes: fs.readFileSync(ruta) }; } });
    return { resultado, orden, llamadas };
  } finally { fs.rmSync(carpeta, { recursive: true, force: true }); }
}

test('sin repositorio configurado no se hace ninguna petición', async () => {
  let peticiones = 0;
  const r = await buscar({ actual: '2026.10.30', repositorio: null, fetchImpl: async () => { peticiones++; } });
  assert.deepEqual(r, { actual: '2026.10.30', nueva: null, disponible: false, instalador: null });
  assert.equal(peticiones, 0);
});

test('la versión nueva se encuentra por tag y se instala tras comprobarla', async () => {
  assert.equal(esMasNueva(version, '2026.10.30'), true);
  const { resultado, orden, llamadas } = await intento();
  assert.deepEqual(resultado, { ok: true, version });
  assert.equal(path.basename(orden.ruta), nombre);
  assert.deepEqual(orden.args, ['/S', '--force-run']);
  assert.deepEqual(orden.bytes, bytes);
  assert.equal(llamadas.filter(c => c.url === api).length, 1);
  assert.ok(llamadas.every(c => c.opciones.redirect === 'manual' && c.opciones.headers['User-Agent']));
});

test('la versión igual o anterior no ofrece actualización', async () => {
  for (const actual of [version, '2026.11.1']) {
    const { fetchImpl, llamadas } = escenario();
    const r = await buscar({ actual, repositorio: repo, fetchImpl });
    assert.equal(r.disponible, false);
    assert.equal(llamadas.length, 1);
  }
});

test('un sha512 distinto impide lanzar el instalador', async () => {
  const { resultado, orden } = await intento({ sha512: crypto.createHash('sha512').update('otro').digest('base64') });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.match(resultado.error, /Huella/);
});

test('el tamaño descargado distinto del anunciado impide lanzar', async () => {
  const { resultado, orden } = await intento({ respuestaExe: Buffer.concat([bytes, Buffer.from('extra')]) });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.match(resultado.error, /Tamaño/);
});

test('una descarga cortada también se rechaza', async () => {
  const { resultado, orden } = await intento({ respuestaExe: bytes.subarray(0, bytes.length - 1) });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.match(resultado.error, /Tamaño/);
});

test('la descarga se corta en cuanto supera el tamaño declarado', async () => {
  let segundoTrozoLeido = false;
  const respuestaExe = { ok: true, status: 200, body: (async function* () {
    yield Buffer.concat([bytes, Buffer.from('extra')]);
    segundoTrozoLeido = true;
    yield Buffer.from('otro');
  })() };
  const { resultado, orden } = await intento({ respuestaExe });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.equal(segundoTrozoLeido, false);
});

test('el tamaño del asset y el de latest.yml deben coincidir', async () => {
  const { fetchImpl } = escenario({ assetSize: bytes.length + 1 });
  const r = await buscar({ actual: '2026.10.30', repositorio: repo, fetchImpl });
  assert.equal(r.disponible, false);
});

test('no se ofrece un instalador por encima del techo de tamaño', async () => {
  const { fetchImpl, llamadas } = escenario({ assetSize: 2 * 1024 * 1024 * 1024 + 1 });
  const r = await buscar({ actual: '2026.10.30', repositorio: repo, fetchImpl });
  assert.equal(r.disponible, false);
  assert.equal(llamadas.some(c => c.url === ficha), false);
});

test('una redirección a http se rechaza antes de pedir ese destino', async () => {
  const url = 'http://objects.githubusercontent.com/archivo.exe';
  const { resultado, orden, llamadas } = await intento({ redireccion: url });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.equal(llamadas.some(c => c.url === url), false);
});

test('una redirección https fuera de GitHub se rechaza', async () => {
  const url = 'https://otro.example/archivo.exe';
  const { resultado, orden, llamadas } = await intento({ redireccion: url });
  assert.equal(resultado.ok, false);
  assert.equal(orden, null);
  assert.equal(llamadas.some(c => c.url === url), false);
});

test('una redirección https al almacén de Releases sí se admite', async () => {
  const { resultado, orden } = await intento({ redireccion: 'https://release-assets.githubusercontent.com/archivo.exe' });
  assert.equal(resultado.ok, true);
  assert.deepEqual(orden.bytes, bytes);
});

test('si falta un asset no se ofrece ni se lanza', async () => {
  for (const falta of [{ sinExe: true }, { sinFicha: true }]) {
    const { fetchImpl } = escenario(falta);
    const r = await buscar({ actual: '2026.10.30', repositorio: repo, fetchImpl });
    assert.equal(r.disponible, false);
  }
});

test('GitHub caído o la petición agotada no producen excepción', async () => {
  const { fetchImpl } = escenario({ sinRed: true });
  assert.equal((await buscar({ actual: '2026.10.30', repositorio: repo, fetchImpl })).disponible, false);
  // El fetch falso espera el abort del reloj; así se comprueba el plazo real
  // sin hacer que el banco espere quince segundos.
  const agotado = async (_url, { signal }) => new Promise((_, rechazar) => {
    signal.addEventListener('abort', () => rechazar(new Error('timeout')), { once: true });
  });
  assert.equal((await buscar({ actual: '2026.10.30', repositorio: repo, fetchImpl: agotado, plazoConsulta: 10 })).disponible, false);
});
