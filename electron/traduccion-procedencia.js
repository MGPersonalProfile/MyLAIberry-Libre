const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { escribirEntero } = require('./escritura-entera.js');

const PROVEEDOR = 'google-translate';
const VERSION = 1;
const DESCONOCIDA = Object.freeze({ proveedor: 'desconocido', clientes: [], mixto: false, confirmado: false, origen: 'antigua' });

const huella = (texto) => crypto.createHash('sha256').update(String(texto ?? '').replace(/\r\n/g, '\n').trim()).digest('hex');

const rutaMetadatos = (rutaHtml) => String(rutaHtml).replace(/\.html$/, '.traduccion.json');

function procedenciaDeEvidencia(evidencia) {
  const clientes = (evidencia?.clientes || []).filter(c => c.fragmentos > 0).map(c => ({ id: c.id, fragmentos: c.fragmentos }))
    .sort((x, y) => y.fragmentos - x.fragmentos);

  if (!clientes.length) return { proveedor: null, clientes: [], mixto: false, confirmado: false, origen: 'peticion' };
  return { proveedor: PROVEEDOR, clientes, mixto: clientes.length > 1, confirmado: true, origen: 'peticion' };
}

function armarMetadatos({ idioma, original, traducido, evidencia, integridad, ahora = () => new Date().toISOString() }) {
  const p = procedenciaDeEvidencia(evidencia);
  return { version: VERSION, idiomaDestino: idioma, huellaOriginal: original == null ? null : huella(original), huellaTraduccion: huella(traducido),
    proveedor: p.proveedor, clientes: p.clientes, procedenciaConfirmada: p.confirmado,
    integridad: { estado: integridad.estado, fragmentos: integridad.fragmentos, fallidos: integridad.fallidos, incidencias: integridad.incidencias },
    comprobadoEn: ahora() };
}

async function metadatosDeTraduccion(rutaHtml, { html, original = null } = {}) {
  let meta;
  try { meta = JSON.parse(await fs.readFile(rutaMetadatos(rutaHtml), 'utf-8')); }
  catch (e) { return { existe: false, vigente: false, procedencia: DESCONOCIDA, integridad: null, motivo: e.code === 'ENOENT' ? 'sin-metadatos' : 'ilegibles' }; }
  if (!meta || meta.version !== VERSION || meta.huellaTraduccion !== huella(html)) {
    return { existe: true, vigente: false, procedencia: DESCONOCIDA, integridad: null, motivo: 'desactualizados' };
  }
  const confirmado = meta.procedenciaConfirmada === true && meta.proveedor === PROVEEDOR && Array.isArray(meta.clientes) && meta.clientes.length > 0;
  const procedencia = confirmado
    ? { proveedor: meta.proveedor, clientes: meta.clientes, mixto: meta.clientes.length > 1, confirmado: true, origen: 'metadatos' }
    : DESCONOCIDA;
  return { existe: true, vigente: true, procedencia, integridad: meta.integridad || null,
    originalCambiado: original != null && meta.huellaOriginal !== huella(original), comprobadoEn: meta.comprobadoEn,

    reparacionIntentada: meta.reparacionIntentada === true && !(original != null && meta.huellaOriginal !== huella(original)) };
}

async function publicarPar({ rutaHtml, html, meta, previo = null, escribir = escribirEntero }) {
  await escribir(rutaHtml, html);
  try {
    await escribir(rutaMetadatos(rutaHtml), JSON.stringify(meta, null, 2));
  } catch (e) {
    try { if (previo?.html != null) await escribir(rutaHtml, previo.html); else await fs.rm(rutaHtml, { force: true }); } catch {  }
    throw new Error(`No se pudo guardar la traducción con sus metadatos: ${e.message}`);
  }
}

module.exports = { PROVEEDOR, DESCONOCIDA, huella, rutaMetadatos, procedenciaDeEvidencia, armarMetadatos, metadatosDeTraduccion, publicarPar };
