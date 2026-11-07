const { traducir, aplicarEnMemoria, idsDePersonajes, normalizar } = require('./index.js');

const nombresDePareja = (pareja) => String(pareja || '').split(/\s*[/&]\s*|\s+x\s+/i).filter(Boolean);

async function buscarFFN(plan, f, { pagina }) {
  const ffn = require('../scrapers/buscar-ffn.js');
  const quiere = !!(plan.seccion && (f.personajes || f.pareja));
  let peticionesWeb = 1;
  let { crudos, opciones } = await ffn.leerListado(plan.url, { personajes: quiere });
  if (quiere) {
    const ids = idsDePersonajes(opciones, [...nombresDePareja(f.pareja), ...(f.personajes || [])]);
    const nuevo = traducir('FanFiction.net', f, { idsPersonajes: ids, pagina });
    if (nuevo.url !== plan.url) {
      Object.assign(plan, nuevo);
      peticionesWeb++;
      ({ crudos } = await ffn.leerListado(plan.url));
    }
  }

  return { obras: ffn.parsearCrudos(crudos, undefined, f.consulta), peticionesWeb };
}

async function buscarAO3(plan, f) {
  const { pedirHTMLConNavegador } = require('../scrapers/ao3-pedir.js');
  return { obras: require('../scrapers/ao3.js').resultadosDeHtml(await pedirHTMLConNavegador(plan.url), f.sinCrossovers === true), peticionesWeb: 1 };
}

const BUSCADORES = {
  AO3: buscarAO3,
  'FanFiction.net': buscarFFN,
  RoyalRoad: (plan) => require('../scrapers/buscar-royalroad.js').buscar({ url: plan.url }),
  Wattpad: (plan) => require('../scrapers/buscar-wattpad.js').buscar({ url: plan.url }),

  Webnovel: (plan, f) => require('../scrapers/buscar-webnovel.js').buscar({ consulta: [f.consulta, f.fandom].filter(Boolean).join(' '), url: plan.url }),
  WeTriedTLs: (plan) => require('../scrapers/buscar-wetriedtls.js').buscar({ url: plan.url }),
  'Project Gutenberg': (plan) => require('../scrapers/buscar-gutenberg.js').buscar({ url: plan.url })
};

async function buscarEnSitio(fuente, pedido, { pagina = 1, buscadores = BUSCADORES } = {}) {
  const f = normalizar(pedido);
  const plan = traducir(fuente, f, { pagina });
  if (!plan.url) return { plan, obras: [], peticionesWeb: 0, aviso: `${fuente} necesita una consulta o un fandom para buscar.` };
  const res = await buscadores[fuente](plan, f, { pagina });
  const crudas = Array.isArray(res) ? res : (res?.obras || []);
  const peticionesWeb = res?.peticionesWeb ?? (Array.isArray(res) ? 1 : (res ? 1 : 0));
  return { plan, obras: aplicarEnMemoria(crudas, f, plan.memoria), peticionesWeb };
}

module.exports = { buscarEnSitio, BUSCADORES, nombresDePareja };
