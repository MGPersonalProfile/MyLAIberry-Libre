const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { proteger, restaurar, marcasPerdidas } = require('./glosario.js');
const { escribirEntero } = require('./escritura-entera.js');

const { traducirTexto, detectarIdioma } = require('./traduccion-clientes.js');
const { traducirFragmentos, comprobarCompleta } = require('./traduccion-fragmentos.js');
const { auditar, gravedad } = require('./traduccion-integridad.js');
const { armarMetadatos, metadatosDeTraduccion, publicarPar, procedenciaDeEvidencia, rutaMetadatos } = require('./traduccion-procedencia.js');
const { marcar, MARCA } = require('./traduccion-a-medias.js');

const ETIQUETAS_IGNORADAS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT']);

function rutaTraduccion(dirFanfic, indice, idioma) {
  return path.join(dirFanfic, `chapter_${indice}.${idioma}.html`);
}

async function traducirHtmlConEvidencia(html, destino, alProgresar, glosario = []) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(`<div id="raiz">${html}</div>`);
  const doc = dom.window.document;
  const raiz = doc.getElementById('raiz');

  const nodos = [];
  const recorrer = (nodo) => {
    for (const hijo of nodo.childNodes) {
      if (hijo.nodeType === 3) {
        if (hijo.textContent.trim().length > 1) nodos.push(hijo);
      } else if (hijo.nodeType === 1) {

        if (!ETIQUETAS_IGNORADAS.has(hijo.tagName) && !hijo.hasAttribute('hidden')) recorrer(hijo);
      }
    }
  };
  recorrer(raiz);

  if (nodos.length === 0) return { html, evidencia: { enviados: 0, recibidos: 0, reintentados: 0, originales: 0, errores: [], clientes: [] } };

  const originales = nodos.map(n => n.textContent);

  const protegidos = originales.map(t => proteger(t.trim(), glosario));

  const traducidos = await traducirFragmentos(
    protegidos.map(p => p.texto),
    destino,
    alProgresar
  );
  comprobarCompleta(traducidos);

  let perdidas = 0;

  nodos.forEach((nodo, i) => {
    const original = originales[i];
    const izquierda = original.match(/^\s*/)[0];
    const derecha = original.match(/\s*$/)[0];
    perdidas += Math.max(0, marcasPerdidas(protegidos[i].texto, traducidos[i]));
    nodo.textContent = izquierda + restaurar(traducidos[i], protegidos[i].tabla) + derecha;
  });

  if (perdidas > 0) {
    console.warn(`[Traduccion] el servicio se comio ${perdidas} marca(s) de glosario: ` +
      'esos nombres salen traducidos en vez de conservarse.');
  }

  return { html: raiz.innerHTML, evidencia: traducidos.evidencia };
}

async function traducirHtml(html, destino, alProgresar, glosario = []) {
  return (await traducirHtmlConEvidencia(html, destino, alProgresar, glosario)).html;
}

const resumenIntegridad = (i) => (i ? { estado: i.estado, fragmentos: i.fragmentos, fallidos: i.fallidos, incidencias: i.incidencias, ...(i.motivos ? { motivos: i.motivos } : {}) } : null);

async function generar(html, idioma, alProgresar, glosario) {
  const { html: salida, evidencia } = await traducirHtmlConEvidencia(html, idioma, alProgresar, glosario);
  const marcado = marcar(salida);
  const integridad = auditar(html, marcado, { glosario, evidencia });
  if (integridad.estado === 'incompleta') {
    throw Object.assign(new Error(`La traducción salió incompleta (${integridad.incidencias[0]}). No se ha guardado; vuelve a intentarlo en un rato.`), { integridad });
  }
  return { html: marcado, evidencia, integridad };
}

function hayQueRehacer(integridad, meta, guardado) {
  if (integridad.estado !== 'incompleta' || meta.reparacionIntentada) return false;
  if (!guardado.includes(MARCA)) return true;
  return integridad.incidencias.some(i => /^(final-perdido|bloque-perdido|respuesta-vacia|reduccion-anomala)/.test(i));
}

async function conservada(destino, original, idioma, alProgresar, glosario, opciones) {
  const guardado = await fs.readFile(destino, 'utf-8');
  const html = fsSync.existsSync(original) ? await fs.readFile(original, 'utf-8') : null;
  const meta = await metadatosDeTraduccion(destino, { html: guardado, original: html });
  const guardada = meta.vigente && !meta.originalCambiado && meta.integridad;
  const integridad = guardada ? meta.integridad : auditar(html, guardado, { glosario });
  const base = { html: guardado, cacheado: true, integridad: resumenIntegridad(integridad), procedencia: meta.procedencia };
  if (!html || !hayQueRehacer(integridad, meta, guardado)) return base;
  try {
    const g = await generar(html, idioma, alProgresar, glosario);
    if (gravedad(g.integridad.estado) > gravedad(integridad.estado)) return base;
    await publicarPar({ rutaHtml: destino, html: g.html, previo: { html: guardado }, escribir: opciones.escribir,
      meta: armarMetadatos({ idioma, original: html, traducido: g.html, evidencia: g.evidencia, integridad: g.integridad }) });
    return { html: g.html, cacheado: false, rehecha: true, integridad: resumenIntegridad(g.integridad), procedencia: procedenciaDeEvidencia(g.evidencia) };
  } catch (e) {

    if (e.integridad) await anotarIntento(destino, idioma, html, guardado, integridad, opciones).catch(() => {});
    return { ...base, aMedias: true, error: e.message };
  }
}

async function anotarIntento(destino, idioma, original, guardado, integridad, opciones) {
  const meta = armarMetadatos({ idioma, original, traducido: guardado, evidencia: null, integridad });
  await (opciones.escribir || escribirEntero)(rutaMetadatos(destino), JSON.stringify({ ...meta, reparacionIntentada: true }, null, 2));
}

async function obtenerCapituloTraducido(dirFanfic, indice, idioma, alProgresar, glosario = [], opciones = {}) {
  const destino = rutaTraduccion(dirFanfic, indice, idioma);
  const original = path.join(dirFanfic, `chapter_${indice}.html`);
  if (fsSync.existsSync(destino)) return conservada(destino, original, idioma, alProgresar, glosario, opciones);
  if (!fsSync.existsSync(original)) throw new Error('Este capítulo todavía no está descargado');

  const html = await fs.readFile(original, 'utf-8');

  const soloTexto = require('./capitulo-valido.js').sinOculto(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const detectado = await detectarIdioma(soloTexto);
  if (detectado && detectado === idioma) {
    return { html, cacheado: false, mismoIdioma: true, idiomaOriginal: detectado, integridad: null, procedencia: null };
  }

  const g = await generar(html, idioma, alProgresar, glosario);
  await publicarPar({ rutaHtml: destino, html: g.html, escribir: opciones.escribir,
    meta: armarMetadatos({ idioma, original: html, traducido: g.html, evidencia: g.evidencia, integridad: g.integridad }) });
  return { html: g.html, cacheado: false, idiomaOriginal: detectado, integridad: resumenIntegridad(g.integridad), procedencia: procedenciaDeEvidencia(g.evidencia) };
}

function tieneTraduccion(dirFanfic, indice, idioma) {
  const ruta = rutaTraduccion(dirFanfic, indice, idioma);
  try {
    const st = fsSync.statSync(ruta);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

async function traducirTitulos(titulos, destino, glosario = []) {
  const protegidos = titulos.map(t => proteger(String(t || ''), glosario));
  const traducidos = await traducirFragmentos(protegidos.map(p => p.texto), destino);

  return traducidos.map((t, i) => restaurar(t || titulos[i] || '', protegidos[i].tabla));
}

async function traducirSinopsis(texto, destino, glosario = []) {
  const limpio = String(texto || '')
    .replace(/<\/p\s*>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .trim();
  if (!limpio) return '';

  const parrafos = limpio.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const protegidos = parrafos.map(p => proteger(p, glosario));
  const traducidos = await traducirFragmentos(protegidos.map(p => p.texto), destino);

  return traducidos
    .map((t, i) => restaurar(t || parrafos[i] || '', protegidos[i].tabla))
    .join('\n\n')
    .trim();
}

module.exports = {
  traducirTexto,
  traducirHtml,
  traducirHtmlConEvidencia,
  traducirTitulos,
  traducirSinopsis,
  detectarIdioma,
  obtenerCapituloTraducido,
  tieneTraduccion,
  rutaTraduccion
};
