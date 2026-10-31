const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { proteger, restaurar, marcasPerdidas } = require('./glosario.js');
const { escribirEntero } = require('./escritura-entera.js');

const MAX_CARACTERES_LOTE = 4000;

const ETIQUETAS_IGNORADAS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT']);

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function rutaTraduccion(dirFanfic, indice, idioma) {
  return path.join(dirFanfic, `chapter_${indice}.${idioma}.html`);
}

const CLIENTES = [
  {
    id: 'dict-chrome-ex',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=dict-chrome-ex&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {
    id: 'at',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=at&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {
    id: 'gtx',
    url: (t, o, d) => 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=${o}&tl=${d}&dt=t&q=${encodeURIComponent(t)}`,
    leer: (j) => (Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null)
  },
  {

    id: 'clients5',
    url: (t, o, d) => 'https://clients5.google.com/translate_a/t'
      + `?client=dict-chrome-ex&sl=${o}&tl=${d}&q=${encodeURIComponent(t)}`,
    leer: (j) => {
      if (Array.isArray(j) && Array.isArray(j[0]) && typeof j[0][0] === 'string') return j[0][0];
      if (Array.isArray(j) && typeof j[0] === 'string') return j[0];
      return null;
    }
  }
];

let clientePreferido = 0;

async function traducirTexto(texto, destino, origen = 'auto') {
  const problemas = [];

  for (let vuelta = 0; vuelta < CLIENTES.length; vuelta++) {
    const i = (clientePreferido + vuelta) % CLIENTES.length;
    const cliente = CLIENTES[i];

    let respuesta;
    try {
      respuesta = await fetch(cliente.url(texto, origen, destino), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(20000)
      });
    } catch (err) {
      problemas.push(`${cliente.id}: ${err.name}`);
      continue;
    }

    if (!respuesta.ok) {
      problemas.push(`${cliente.id}: HTTP ${respuesta.status}`);
      continue;
    }

    let datos;
    try {
      datos = await respuesta.json();
    } catch {
      problemas.push(`${cliente.id}: respuesta ilegible`);
      continue;
    }

    const salida = cliente.leer(datos);
    if (salida === null || salida === undefined) {
      problemas.push(`${cliente.id}: formato inesperado`);
      continue;
    }

    if (i !== clientePreferido) {
      console.log(`[Traducción] cambiando a "${cliente.id}" (${problemas.join(', ')})`);
      clientePreferido = i;
    }
    return salida;
  }

  const hubo429 = problemas.some(p => p.includes('429'));
  throw new Error(hubo429
    ? 'El servicio de traducción está limitando las peticiones. Prueba de nuevo en unos minutos.'
    : `No se pudo traducir: ${problemas.join(' · ')}`);
}

function muestraRepresentativa(texto, largo = 500) {
  const t = String(texto || '');
  if (t.length <= largo) return t;
  const desde = Math.floor((t.length - largo) / 2);
  return t.slice(desde, desde + largo);
}

const CLIENTES_CON_IDIOMA = ['dict-chrome-ex', 'at', 'gtx'];

async function detectarIdioma(muestra) {
  const texto = encodeURIComponent(muestraRepresentativa(muestra));

  const preferido = CLIENTES[clientePreferido]?.id;
  const orden = [...new Set([preferido, ...CLIENTES_CON_IDIOMA])]
    .filter(id => CLIENTES_CON_IDIOMA.includes(id));

  for (const cliente of orden) {
    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=${cliente}&sl=auto&tl=en&dt=t&q=${texto}`;
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) continue;
      const datos = await r.json();
      if (typeof datos?.[2] === 'string') return datos[2];
    } catch {
      continue;
    }
  }
  return null;
}

async function traducirFragmentos(fragmentos, destino, alProgresar) {
  const salida = new Array(fragmentos.length);

  const limpios = fragmentos.map(f => f.replace(/\s*\n\s*/g, ' '));

  const lotes = [];
  let actual = [];
  let largo = 0;
  limpios.forEach((frag, i) => {
    if (actual.length > 0 && largo + frag.length > MAX_CARACTERES_LOTE) {
      lotes.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push({ i, frag });
    largo += frag.length + 1;
  });
  if (actual.length) lotes.push(actual);

  let hechos = 0, fallidos = 0;
  for (const lote of lotes) {
    const bloque = lote.map(x => x.frag).join('\n');
    let resuelto = false;

    try {
      const traducido = await traducirTexto(bloque, destino);
      const lineas = traducido.split('\n');
      if (lineas.length === lote.length) {
        lote.forEach((x, k) => { salida[x.i] = lineas[k]; });
        resuelto = true;
      }

    } catch (err) {

      if (/limitando/.test(err.message)) throw err;
    }

    if (!resuelto) {
      for (const x of lote) {
        try {
          salida[x.i] = await traducirTexto(x.frag, destino);
        } catch {
          salida[x.i] = x.frag;
          fallidos++;
        }
        await dormir(120);
      }
    }

    hechos += lote.length;
    if (alProgresar) alProgresar({ hechos, total: fragmentos.length });
    await dormir(180);
  }

  return Object.assign(salida.map((s, i) => (s == null ? fragmentos[i] : s)), { fallidos });
}

function comprobarCompleta(traducidos) {
  const total = traducidos.length, fallidos = traducidos.fallidos || 0;
  if (fallidos > Math.max(2, Math.ceil(total * 0.05))) {
    throw new Error(`La traducción se cortó: ${fallidos} de ${total} párrafos no se pudieron traducir. No se ha guardado; vuelve a intentarlo en un rato.`);
  }
}

async function traducirHtml(html, destino, alProgresar, glosario = []) {
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

  if (nodos.length === 0) return html;

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

  return raiz.innerHTML;
}

async function obtenerCapituloTraducido(dirFanfic, indice, idioma, alProgresar, glosario = []) {
  const destino = rutaTraduccion(dirFanfic, indice, idioma);

  const original = path.join(dirFanfic, `chapter_${indice}.html`);
  if (fsSync.existsSync(destino)) {
    const guardado = await fs.readFile(destino, 'utf-8');

    if (!fsSync.existsSync(original)) return { html: guardado, cacheado: true };
    const html = await fs.readFile(original, 'utf-8');
    if (!require('./traduccion-a-medias.js').aMedias(html, guardado)) return { html: guardado, cacheado: true };
    try {
      const rehecha = require('./traduccion-a-medias.js').marcar(await traducirHtml(html, idioma, alProgresar, glosario));
      await escribirEntero(destino, rehecha);
      return { html: rehecha, cacheado: false, rehecha: true };
    } catch (e) {
      return { html: guardado, cacheado: true, aMedias: true, error: e.message };
    }
  }

  if (!fsSync.existsSync(original)) {
    throw new Error('Este capítulo todavía no está descargado');
  }

  const html = await fs.readFile(original, 'utf-8');

  const soloTexto = require('./capitulo-valido.js').sinOculto(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const detectado = await detectarIdioma(soloTexto);
  if (detectado && detectado === idioma) {
    return { html, cacheado: false, mismoIdioma: true, idiomaOriginal: detectado };
  }

  const traducido = require('./traduccion-a-medias.js').marcar(await traducirHtml(html, idioma, alProgresar, glosario));

  await escribirEntero(destino, traducido);
  return { html: traducido, cacheado: false, idiomaOriginal: detectado };
}

function tieneTraduccion(dirFanfic, indice, idioma) {
  return fsSync.existsSync(rutaTraduccion(dirFanfic, indice, idioma));
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
  traducirTitulos,
  traducirSinopsis,
  detectarIdioma,
  obtenerCapituloTraducido,
  tieneTraduccion,
  rutaTraduccion
};
