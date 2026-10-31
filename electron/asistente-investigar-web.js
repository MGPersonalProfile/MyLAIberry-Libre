const { crearNavegador } = require('./asistente-navegador');
const { filtrarObras, claveDeObra } = require('./asistente-busqueda');
const ao3 = require('./scrapers/ao3');
const ffn = require('./scrapers/buscar-ffn');
const rr = require('./scrapers/buscar-royalroad');
const wattpad = require('./scrapers/buscar-wattpad');
const { pertinencia } = require('./relevancia.js');
const { JSDOM } = require('jsdom');
const { CATEGORIA } = require('./etiquetas.js');

const MAX_PASOS = 8;

const RESERVA_FICHAS = 4;
const FUENTES = ['AO3', 'FanFiction.net', 'RoyalRoad', 'Wattpad'];
const ORDEN = { popularidad: 'kudos_count', palabras: 'word_count', recientes: 'revised_at', relevancia: '_score' };

function consultaDe(f) {
  return [f.consulta, f.fandom, f.pareja, f.personajes, f.etiquetas]
    .flat().filter(Boolean).map(x => String(x).trim()).filter(Boolean).join(' ').slice(0, 300);
}

function casaPareja(etiqueta, pedida) {

  const nombres = s => String(s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().split(/\s*[/&]\s*|\s+x\s+/)
    .map(n => n.split(/[^\p{L}\p{N}]+/u).filter(Boolean)).filter(n => n.length);
  const union = s => (s.includes('/') ? '/' : s.includes('&') ? '&' : '');
  const quiero = nombres(pedida), hay = nombres(etiqueta);
  if (quiero.length < 2) return String(etiqueta).toLowerCase().includes(String(pedida).toLowerCase());
  if (union(pedida) && union(etiqueta) && union(pedida) !== union(etiqueta)) return false;
  return quiero.every(q => hay.some(h => q.every(palabra => h.includes(palabra))));
}

function coincide(obra, f) {
  const tags = (obra.tags || []).map(t => ({ nombre: String(t.name || t).toLowerCase(), categoria: t.category || '' }));
  const filtros = [
    [f.fandom, 'fandom'], [f.pareja, 'relationship'], [f.personajes, 'character'],
    [f.etiquetas, 'freeform'], [f.idioma, 'language'], [f.valoracion, 'rating']
  ];
  return filtros.every(([valores, categoria]) => {
    const presentes = tags.filter(t => t.categoria === categoria);
    return !presentes.length || [valores].flat().filter(Boolean)
      .every(valor => presentes.some(t => (categoria === 'relationship' ? casaPareja(t.nombre, valor) : t.nombre.includes(String(valor).toLowerCase()))));
  });
}

function sinVerificar(obra, f) {
  const categorias = new Set((obra.tags || []).map(t => t.category));
  const pendientes = [['fandom', 'fandom'], ['pareja', 'relationship'], ['personajes', 'character'], ['etiquetas', 'freeform'],
    ['idioma', 'language'], ['valoracion', 'rating']]
    .filter(([campo, categoria]) => f[campo] && !categorias.has(categoria)).map(([campo]) => campo);
  if (f.minPalabras && !obra.wordCount) pendientes.push('palabras');
  if (f.completa && obra.completa === undefined) pendientes.push('completa');
  if (f.orden && (obra.source === 'Wattpad' || (obra.source === 'FanFiction.net' && f.orden === 'recientes'))) pendientes.push('orden');
  return pendientes;
}

function breve(o) {
  const medida = { AO3: 'kudos', 'FanFiction.net': 'favoritos', RoyalRoad: 'seguidores', Wattpad: 'votos' }[o.source] || 'popularidad';
  return { title: o.title, author: o.author, url: o.url, source: o.source,

    synopsis: String(o.synopsis || '').slice(0, 450),
    tags: [...(o.tags || [])].sort((a, b) => (b?.category === CATEGORIA) - (a?.category === CATEGORIA)).slice(0, 16),
    wordCount: o.wordCount, ...(o.source === 'RoyalRoad' && o.wordCount ? { palabrasEstimadas: true } : {}),
    totalChapters: o.totalChapters || o.chapters?.length || undefined,
    kudos: o.kudos, medidaPopularidad: medida, completa: o.completa, autorUrl: o.autorUrl };
}

function ordenar(obras, orden) {
  const clave = orden === 'palabras' ? 'wordCount' : 'kudos';
  return orden === 'relevancia' || orden === 'recientes' ? obras : obras.sort((a, b) => (b[clave] || 0) - (a[clave] || 0));
}

function sinDuplicados(obras) {
  const visto = new Set();
  return obras.filter(o => { const k = claveDeObra(o.url); if (!k || visto.has(k)) return false; visto.add(k); return true; });
}

async function perfilRoyalRoad(actual, navegador) {
  const adaptador = require('./scrapers/autor-royalroad');
  const base = actual.split('?')[0];
  const obras = [];
  let hayMas = false;
  for (let pagina = 1; pagina <= 3; pagina++) {
    if (pagina > 1) await navegador.abrir(`${base}?page=${pagina}`);
    const r = await navegador.ejecutar(adaptador.LECTOR_PERFIL);
    if (!r.listo || r.error || r.noExiste) throw new Error('RoyalRoad no devolvió un perfil público válido.');
    const nuevas = sinDuplicados(adaptador.trocearPerfil(r.html, { autor: r.nombre, autorUrl: base }))
      .filter(o => !obras.some(vieja => vieja.url === o.url));
    obras.push(...nuevas);
    hayMas = !!r.hasNext;
    if (!hayMas || !nuevas.length || navegador.paginas >= navegador.maxPaginas) break;
  }
  return { obras: obras.slice(0, 25).map(breve), paginasVisitadas: navegador.paginas, hayMas };
}

function crearInvestigador({ signal, progreso, navegador = crearNavegador({ signal, progreso }) } = {}) {
  let pasos = 0;
  const paso = () => { if (++pasos > MAX_PASOS) throw new Error(`La investigación tiene un máximo de ${MAX_PASOS} pasos.`); };

  async function buscar(args) { return buscarHasta(args, navegador.maxPaginas); }

  async function buscarHasta({ consulta, fandom, pareja, personajes, etiquetas, idioma, minPalabras,
    completa, valoracion, orden = 'popularidad', fuente, paginas = 2 } = {}, tope) {
    if (!Number.isInteger(paginas) || paginas < 1 || paginas > 3) throw new Error('Se admiten de 1 a 3 páginas por búsqueda.');
    const filtros = { consulta, fandom, pareja, personajes, etiquetas, idioma, minPalabras, completa, valoracion };
    const q = consultaDe(filtros);
    if (!q) throw new Error('La búsqueda necesita al menos una pista.');
    const sitios = fuente ? [fuente] : FUENTES;
    if (sitios.some(s => !FUENTES.includes(s))) throw new Error('Sitio de búsqueda no admitido.');
    paso();
    const obras = [], errores = [];
    for (const sitio of sitios) for (let pagina = 1; pagina <= paginas; pagina++) {
      if (sitio === 'Wattpad' && pagina > 1) break;
      if (navegador.paginas >= tope) break;
      try {
        const argumento = { consulta: q, orden: ORDEN[orden] || ORDEN.popularidad, pagina,
          completa, minPalabras };
        const adaptador = sitio === 'AO3' ? ao3 : sitio === 'FanFiction.net' ? ffn : sitio === 'Wattpad' ? wattpad : rr;
        await navegador.abrir(adaptador.urlDeBusqueda(argumento));
        let lista;
        if (sitio === 'AO3' || sitio === 'Wattpad') lista = adaptador.resultadosDeHtml(await navegador.ejecutar('document.documentElement.outerHTML'));
        else lista = adaptador.parsearCrudos(await navegador.ejecutar(adaptador.LECTOR), argumento.orden, q);
        if (!lista.length) break;

        if (sitio === 'Wattpad') lista = lista.filter(o => pertinencia(o, q) >= 2 / 3);
        obras.push(...filtrarObras(lista, filtros).filter(o => coincide(o, filtros))
          .map(o => ({ ...breve(o), sinVerificar: sinVerificar(o, filtros) })));
      } catch (e) { errores.push(`${sitio}, página ${pagina}: ${e.message}`); break; }
    }
    const unicas = ordenar(sinDuplicados(obras), orden);
    return { obras: unicas.slice(0, 30), encontradas: unicas.length, paginasVisitadas: navegador.paginas,
      errores, aviso: 'Los filtros sin datos explícitos del sitio no se dan por confirmados. Wattpad sólo ofrece aquí su primera tanda pública: page=2 repite los resultados.' };
  }

  async function ficha(url) {
    paso();
    const win = await navegador.abrir(url);
    const actual = win.webContents.getURL();
    const html = await navegador.ejecutar('document.documentElement.outerHTML');
    const preliminar = new JSDOM(html).window.document;
    require('./scrapers/navegar').exigirQueNoSeaUnReto('La ficha', { titulo: preliminar.title, texto: preliminar.body?.textContent, url: actual });
    let obra;
    if (/archiveofourown\.org\/works\/(\d+)/.test(actual)) {
      obra = ao3.parsearPaginaNormal(html, RegExp.$1);
    } else if (/fanfiction\.net\/s\/(\d+)/.test(actual)) {
      const id = RegExp.$1;
      const crudo = await navegador.ejecutar(require('./scrapers/ffn').LECTOR_FICHA);
      if (!crudo.listo || crudo.noExiste || crudo.error) throw new Error('FanFiction.net no devolvió una ficha válida.');
      const base = require('./scrapers/ffn');
      const meta = base.parseMeta(crudo.metaCrudo);
      obra = base.armarObra(id, crudo, meta, base.listaDeCapitulos(id, crudo.opciones || [], meta.chapters));
    } else if (/royalroad\.com\/fiction\//.test(actual)) {
      const base = require('./scrapers/royalroad');
      const meta = await navegador.ejecutar(base.GUION_METADATOS);
      if (meta.error) throw new Error(meta.error);
      obra = base.armarResultado(meta, meta.capitulos || []);
    } else if (/wattpad\.com\/story\//.test(actual)) {
      obra = wattpad.fichaDeHtml(html, actual);
    } else throw new Error('La ficha no pertenece a un sitio admitido.');
    if (!obra.title) throw new Error('La ficha no trajo un título verificable.');
    const doc = preliminar;
    const enlaces = [...doc.querySelectorAll('a[href]')].map(a => ({
      texto: (a.textContent || '').trim().slice(0, 100), url: new URL(a.getAttribute('href'), actual).href
    })).filter(a => /\/(series|users|u|bookmarks|collections)\//.test(a.url));
    if (obra.autorUrl && /archiveofourown\.org/.test(actual)) {
      enlaces.push({ texto: 'Bookmarks públicos del autor',
        url: `${obra.autorUrl.replace(/\/pseuds\/.*$/, '')}/bookmarks` });
    }
    const unicos = [...new Map(enlaces.map(e => [e.url, e])).values()].slice(0, 20);
    return { ...breve(obra), enlaces: unicos, paginasVisitadas: navegador.paginas };
  }

  async function pistas({ url, tipo = 'autor' }) {
    paso();
    if (!['autor', 'serie', 'bookmarks', 'recomendaciones'].includes(tipo)) throw new Error('Tipo de pista no admitido.');
    if (tipo === 'autor' && /royalroad\.com\/profile\/\d+/.test(url)) {
      url = require('./scrapers/autor-royalroad').urlDeAutor(url) + '/fictions';
    }
    if (/archiveofourown\.org\/users\//.test(url)) {
      const autor = ao3.urlDeAutor(url);
      if (tipo === 'autor' && !/\/works(?:\?|$)/.test(url)) url = `${autor}/works`;
      if (tipo === 'bookmarks' && !/\/bookmarks(?:\?|$)/.test(url)) {
        url = `${autor.replace(/\/pseuds\/.*$/, '')}/bookmarks`;
      }
    }
    const win = await navegador.abrir(url);
    const actual = win.webContents.getURL();
    const html = await navegador.ejecutar('document.documentElement.outerHTML');
    if (/archiveofourown\.org/.test(actual)) {
      const doc = new JSDOM(html).window.document;
      const filas = doc.querySelectorAll('ol.work.index.group > li, ol.bookmark.index.group > li');
      const limpiar = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
      const obras = [...filas].map(f => ao3.resultadosDeHtml(`<html><body><ol class="work index group">${f.outerHTML}</ol></body></html>`)[0]).filter(Boolean);
      return { tipo, obras: sinDuplicados(obras).slice(0, 25).map(breve), paginasVisitadas: navegador.paginas };
    }
    if (/fanfiction\.net/.test(actual)) {
      const obras = ffn.parsearCrudos(await navegador.ejecutar(ffn.LECTOR), 'kudos_count', '');
      return { tipo, obras: sinDuplicados(obras).slice(0, 25).map(breve), paginasVisitadas: navegador.paginas };
    }
    if (/royalroad\.com\/profile\//.test(actual)) {
      return { tipo, ...await perfilRoyalRoad(actual, navegador) };
    }
    if (/wattpad\.com/.test(actual)) {
      const obras = wattpad.resultadosDeHtml(html);
      if (obras.length) return { tipo, obras: sinDuplicados(obras).slice(0, 25).map(breve), paginasVisitadas: navegador.paginas };
    }
    throw new Error('Ese sitio no publica una lista compatible para esta pista.');
  }

  async function investigar({ consultas, ...filtros }) {
    const terminos = (consultas || []).filter(Boolean).slice(0, 3);
    if (!terminos.length) throw new Error('La investigación necesita una consulta.');
    const lotes = [], errores = [];
    const tope = Math.max(navegador.maxPaginas - RESERVA_FICHAS, 1);

    if (navegador.paginas >= tope) {
      throw new Error(`Este turno ya abrió ${navegador.paginas} de ${navegador.maxPaginas} páginas; las que quedan son para abrir fichas. Investiga en otro turno.`);
    }
    for (const consulta of terminos) {
      if (pasos >= MAX_PASOS || navegador.paginas >= tope) break;
      const r = await buscarHasta({ ...filtros, consulta, paginas: Math.min(filtros.paginas || 2, 2) }, tope);
      lotes.push(...r.obras.map(o => ({ ...o, motivo: `Apareció al buscar «${consulta}»; popularidad publicada: ${o.kudos || 0} ${o.medidaPopularidad} en ${o.source}.` })));
      errores.push(...r.errores);
    }
    return { obras: ordenar(sinDuplicados(lotes), filtros.orden).slice(0, 20),
      paginasVisitadas: navegador.paginas, pasos, errores };
  }

  let libre = null;
  const web = () => (libre ||= require('./asistente-web-libre').crearWebLibre({ signal, progreso }));
  return { buscar, ficha, pistas, investigar,
    leer: (url, opciones) => web().leer(url, opciones), buscarEnInternet: args => web().buscarEnInternet(args),
    cerrar: () => { navegador.cerrar(); libre?.cerrar(); }, get paginas() { return navegador.paginas + (libre?.paginas || 0); } };
}

module.exports = { crearInvestigador, consultaDe, coincide, sinDuplicados, breve, MAX_PASOS, RESERVA_FICHAS };
