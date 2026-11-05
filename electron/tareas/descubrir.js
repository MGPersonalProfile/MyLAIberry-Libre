const cola = require('../cola.js');
const { getFanfics, getAutores, getSuscripciones, addFanfic,
  marcarAutorComprobado, marcarSuscripcionComprobada } = require('../db.js');
const { leerAutor } = require('../scrapers/index.js');
const { buscar: buscarEnAO3, leerMarcadores } = require('../scrapers/ao3.js');
const { filtrarNuevas, paginaSiguiente } = require('../umbral.js');
const { claveDeObra } = require('../misma-obra.js');
const { avisar } = require('../ventana.js');

async function comprobarAutor({ url }) {
  const autor = (await getAutores()).find(a => a.url === url);
  if (!autor) return;

  const { obras } = await leerAutor(url);

  const vistos = new Set(autor.vistos || []);
  const yaTengo = new Set((await getFanfics()).map(f => claveDeObra(f.url)));
  const nuevas = obras.filter(o => !vistos.has(o.idOrigen) && !yaTengo.has(claveDeObra(o.url)));

  for (const o of nuevas) {
    await guardarDescubrimiento(o);
    console.log(`[Autores] ${autor.nombre}: descubierta "${o.title}" (${o.totalChapters} cap.)`);
  }

  await marcarAutorComprobado(url, obras.map(o => o.idOrigen));

  if (nuevas.length > 0) {
    avisar('discoveries-updated', { cuantas: nuevas.length });
  }
}

const EN_ESPERA_MAXIMO = 30;

async function comprobarBusqueda({ id }) {
  const sub = (await getSuscripciones()).find(s => s.id === id);
  if (!sub) return;

  const paginas = { ...(sub.paginas || {}) };
  const FUENTES = [
    ['AO3', (pagina) => buscarEnAO3({ consulta: sub.consulta, pagina })],
    ['RoyalRoad', (pagina) => require('../scrapers/buscar-royalroad.js').buscar({ consulta: sub.consulta, pagina })],
    ['FanFiction.net', (pagina) => require('../scrapers/buscar-ffn.js').buscar({ consulta: sub.consulta, pagina })],

    ['WeTriedTLs', (pagina) => require('../scrapers/buscar-wetriedtls.js').buscar({ consulta: sub.consulta, pagina })],
    ['Webnovel', (pagina) => require('../scrapers/buscar-webnovel.js').buscar({ consulta: sub.consulta, pagina })]
  ];

  const biblioteca = await getFanfics();
  const conocido = { vistos: sub.vistos, urlsConocidas: biblioteca.map(f => f.url) };
  const obras = [];

  const { pertinencia } = require('../relevancia.js');
  const SE_FILTRAN_SOLOS = new Set(['AO3', 'Webnovel']);
  const ajenas = [];
  for (const [nombre, buscar] of FUENTES) {
    const pagina = paginas[nombre] || 1;
    try {
      const r = (await buscar(pagina)) || [];
      const utiles = SE_FILTRAN_SOLOS.has(nombre) ? r : r.filter(o => pertinencia(o, sub.consulta) >= 2 / 3);
      ajenas.push(...r.filter(o => !utiles.includes(o)).map(o => o.idOrigen));
      obras.push(...utiles);
      paginas[nombre] = paginaSiguiente(pagina, r, conocido);
    } catch (err) {
      console.warn(`[Suscripción] ${nombre}: ${err.message}`);
    }
  }

  const frescas = new Set(obras.map(o => o.idOrigen));
  obras.unshift(...(sub.enEspera || []).filter(o => o && !frescas.has(o.idOrigen)));
  if (obras.length === 0) {
    await marcarSuscripcionComprobada(id, ajenas.length ? [...new Set([...sub.vistos, ...ajenas])] : undefined, paginas, []);
    return;
  }

  const nuevas = filtrarNuevas(obras, { ...conocido, umbral: sub.umbral, tope: 3 });

  for (const o of nuevas) {
    await guardarDescubrimiento(o);
    console.log(`[Suscripción] "${sub.consulta}": descubierta "${o.title}" (${o.kudos} kudos)`);
  }

  const enEspera = new Set(nuevas.enEspera || []);
  const esperan = obras.filter(o => enEspera.has(o.idOrigen)).slice(0, EN_ESPERA_MAXIMO);
  await marcarSuscripcionComprobada(id, [...new Set([...sub.vistos, ...obras.map(o => o.idOrigen).filter(i => !enEspera.has(i)), ...ajenas])], paginas, esperan);

  if (nuevas.length > 0) {
    avisar('discoveries-updated', { cuantas: nuevas.length });
  }
}

async function importarMarcadores({ url, pagina = 1 }) {
  const { obras, hayMas, total } = await leerMarcadores(url, pagina);

  const yaTengo = new Set((await getFanfics()).map(f => claveDeObra(f.url)));
  let nuevas = 0;

  for (const o of obras) {
    if (yaTengo.has(claveDeObra(o.url))) continue;
    await guardarDescubrimiento(o);
    nuevas++;
  }

  console.log(`[Marcadores] página ${pagina}: ${nuevas} nueva(s) de ${obras.length}${total ? ` (${total} en total)` : ''}.`);

  if (hayMas && obras.length > 0) {
    await cola.encolar('importar-marcadores', { url, pagina: pagina + 1 });
  }

  avisar('discoveries-updated', { cuantas: nuevas, pagina, hayMas });
}

async function guardarDescubrimiento(storyData) {

  const { sinCifras, ...datos } = storyData;
  const saved = await addFanfic({ ...datos, origen: 'descubierta' });
  if (!saved) return saved;
  const { preferencias } = await require('../db').getPreferenciasDescubrimientos();

  if (saved.origen !== 'descubierta' || (!saved.propuesta && require('../descubrimientos-preferencias').oculta(saved, preferencias))) return saved;

  if (Array.isArray(saved.chapterList) && saved.chapterList.length > 0) {
    await cola.encolar('descargar-capitulos', { fanficId: String(saved.id), hasta: 1 });
  } else {

    await cola.encolar('comprobar-capitulos', { fanficId: String(saved.id) });
  }

  if (saved && (saved.synopsis || '').trim()) {
    await cola.encolar('traducir-sinopsis', { fanficId: String(saved.id) });
  }
  return saved;
}

module.exports = {
  comprobarAutor,
  comprobarBusqueda,
  importarMarcadores,
  guardarDescubrimiento
};
