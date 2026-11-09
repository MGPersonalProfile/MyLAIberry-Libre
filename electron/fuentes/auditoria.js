const { comprobarDestino } = require('../asistente-web-libre');
const { JSDOM } = require('jsdom');

const AUDITORIA_7_FUENTES = {
  Webnovel: {
    nombre: 'Webnovel',
    buscadorEspecifico: true,
    busquedaWebGeneral: false,
    fichasCompletas: true,
    indiceCapitulos: true,
    requiereAutenticacion: false,
    retos: 'bloqueo_403_o_reto_js',
    verificable: ['titulo', 'autor', 'sinopsis', 'capitulos', 'votos', 'generos']
  },
  WeTriedTLs: {
    nombre: 'WeTriedTLs',
    buscadorEspecifico: true,
    busquedaWebGeneral: false,
    fichasCompletas: true,
    indiceCapitulos: true,
    requiereAutenticacion: false,
    retos: 'ninguno_habitual',
    verificable: ['titulo', 'capitulos', 'url', 'otrosTitulos']
  },
  SpaceBattles: {
    nombre: 'SpaceBattles',
    buscadorEspecifico: false,
    busquedaWebGeneral: true,
    fichasCompletas: true,
    indiceCapitulos: true,
    requiereAutenticacion: false,
    retos: 'Cloudflare',
    verificable: ['titulo', 'autor', 'threadmarks', 'capitulos', 'url']
  },
  SufficientVelocity: {
    nombre: 'SufficientVelocity',
    buscadorEspecifico: false,
    busquedaWebGeneral: true,
    fichasCompletas: true,
    indiceCapitulos: true,
    requiereAutenticacion: false,
    retos: 'Cloudflare',
    verificable: ['titulo', 'autor', 'threadmarks', 'capitulos', 'url']
  },
  'Questionable Questing': {
    nombre: 'Questionable Questing',
    buscadorEspecifico: false,
    busquedaWebGeneral: true,
    fichasCompletas: false,
    indiceCapitulos: true,
    requiereAutenticacion: 'parcial_nsfw',
    retos: 'login_requerido_nsfw',
    verificable: ['titulo', 'autor_publico', 'url_hilo']
  },
  ScribbleHub: {
    nombre: 'ScribbleHub',
    buscadorEspecifico: false,
    busquedaWebGeneral: true,
    fichasCompletas: true,
    indiceCapitulos: true,
    requiereAutenticacion: false,
    retos: 'Cloudflare',
    verificable: ['titulo', 'autor', 'sinopsis', 'etiquetas', 'capitulos', 'url']
  },
  NovelUpdates: {
    nombre: 'NovelUpdates',
    buscadorEspecifico: false,
    busquedaWebGeneral: true,
    fichasCompletas: false,
    indiceCapitulos: false,
    requiereAutenticacion: false,
    retos: 'Cloudflare_y_redirecciones',
    verificable: ['titulo', 'autor', 'sinopsis', 'generos', 'traductor', 'url']
  }
};

function auditarFuente(fuente) {
  return AUDITORIA_7_FUENTES[fuente] || null;
}

function canonizarUrl(u) {
  try {
    const obj = new URL(u);
    return `${obj.origin}${obj.pathname.replace(/\/+$/, '')}`;
  } catch {
    return String(u || '').trim();
  }
}

function extraerDeHtml(html, urlBase = '') {
  if (!html) return {};
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const titleEl = doc.querySelector('.p-title-value, .fic_title, .seriestitlenu, h1') || doc.querySelector('title');
    const rawTitle = titleEl?.textContent?.trim() || '';
    const title = rawTitle.replace(/\s*\|.*$/, '').trim();
    const author = doc.querySelector('.username, .auth_name_fic, #showauthors')?.textContent?.replace(/^by\s+/i, '').trim() || '';
    const capitulos = [...doc.querySelectorAll('.threadmark-list a, .table_contents_list a, #myTable a')]
      .map(a => {
        const rawHref = a.getAttribute('href') || '';
        let href = rawHref;
        if (rawHref && urlBase) {
          try { href = new URL(rawHref, urlBase).href; } catch {}
        }
        return { titulo: a.textContent.trim(), url: href };
      });
    const matchCap = html.match(/Threadmarks\s*\((\d+)\s+chapters?\)/i);
    const totalChapters = matchCap ? Number(matchCap[1]) : (capitulos.length || undefined);
    return { title, author, capitulos, totalChapters };
  } catch {
    return {};
  }
}

function clasificarEstadoFuente(dato, opciones, fichaConsultada, title, author, hayContradiccion = false) {
  const sinVerificar = [];
  if (!dato.synopsis && !dato.description) sinVerificar.push('sinopsis');
  if (!author) sinVerificar.push('autor');
  let estadoVerificacion = 'candidato';
  let limitacion;

  if (dato.bloqueado || opciones.bloqueado || dato.codigoHttp === 403 || opciones.codigoHttp === 403) {
    limitacion = { tipo: 'bloqueo', codigoHttp: opciones.codigoHttp || dato.codigoHttp || 403, mensaje: 'Acceso bloqueado por el servidor externo.' };
  } else if (dato.reto || opciones.reto || (dato.html && /cf-turnstile|Just a moment|You must be logged in/i.test(dato.html))) {
    limitacion = { tipo: 'reto', mensaje: 'Se detectó reto o comprobación humana en la fuente.' };
  } else if (hayContradiccion) {
    sinVerificar.push('autor_contradictorio');
  } else if (fichaConsultada && title && author) {
    estadoVerificacion = 'confirmado';
  }
  return { estadoVerificacion, sinVerificar, limitacion };
}

async function normalizarResultadoFuente(crudo = {}, opciones = {}) {
  const dato = crudo || {};
  const fuente = opciones.fuente || dato.fuente || 'Desconocida';
  const url = dato.url || opciones.url || (dato.slug ? `https://wetriedtls.com/series/${dato.slug}` : (dato.bookId ? `https://www.webnovel.com/book/${dato.bookId}` : ''));
  if (url) {
    await comprobarDestino(url, opciones.resolver);
  }

  const parseadoHtml = dato.html ? extraerDeHtml(dato.html, url) : {};
  const title = dato.title || dato.bookName || parseadoHtml.title || '';
  const author = dato.author || dato.authorName || parseadoHtml.author || '';
  const synopsis = dato.synopsis || dato.description || '';
  const totalChapters = Number(dato.totalChapters || dato.totalChapterNum || dato.total_chapters || parseadoHtml.totalChapters || parseadoHtml.capitulos?.length || 0) || undefined;
  const tags = (dato.tags || dato.tagInfo || []).map(t => typeof t === 'string' ? t : (t.tagName || t.name || ''));

  const esCache = opciones.origen === 'cache_buscador';
  const fichaConsultada = opciones.fichaConsultada === true && !esCache;
  const autorContradictorio = Boolean((dato.author && parseadoHtml.author && dato.author.trim().toLowerCase() !== parseadoHtml.author.trim().toLowerCase()) || (dato.author && dato.sinopsisAutor && dato.author !== dato.sinopsisAutor));
  const hayContradiccion = autorContradictorio || Boolean(opciones.datosContradictorios);
  const { estadoVerificacion, sinVerificar, limitacion } = clasificarEstadoFuente(dato, opciones, fichaConsultada, title, author, hayContradiccion);

  return {
    title,
    author,
    url,
    urlCanonica: canonizarUrl(url),
    fuente,
    synopsis,
    tags,
    totalChapters,
    capitulos: parseadoHtml.capitulos || dato.capitulos || [],
    estadoVerificacion,
    sinVerificar,
    limitacion,
    contradicciones: hayContradiccion ? ['Autor no coincide con el metadato'] : [],
    evidence: { fuente, fichaConsultada, auditada: !!AUDITORIA_7_FUENTES[fuente] }
  };
}

function deduplicarResultadosFuentes(lista = []) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const res = [];
  for (const item of lista) {
    if (!item) continue;
    const clave = item.urlCanonica || canonizarUrl(item.url || '');
    if (clave && vistos.has(clave)) continue;
    if (clave) vistos.add(clave);
    res.push(item);
  }
  return res;
}

module.exports = {
  AUDITORIA_7_FUENTES,
  auditarFuente,
  normalizarResultadoFuente,
  canonizarUrl,
  deduplicarResultadosFuentes
};
