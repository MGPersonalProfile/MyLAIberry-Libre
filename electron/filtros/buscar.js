const { traducir, aplicarEnMemoria, idsDePersonajes, normalizar } = require('./index.js');

const nombresDePareja = (pareja) => String(pareja || '').split(/\s*[/&]\s*|\s+x\s+/i).filter(Boolean);

async function buscarFFN(plan, f, { pagina }) {
  const ffn = require('../scrapers/buscar-ffn.js');
  const quiere = !!(plan.seccion && (f.personajes || f.pareja));
  let { crudos, opciones } = await ffn.leerListado(plan.url, { personajes: quiere });
  if (quiere) {
    const ids = idsDePersonajes(opciones, [...nombresDePareja(f.pareja), ...(f.personajes || [])]);
    const nuevo = traducir('FanFiction.net', f, { idsPersonajes: ids, pagina });
    if (nuevo.url !== plan.url) {
      Object.assign(plan, nuevo);
      ({ crudos } = await ffn.leerListado(plan.url));
    }
  }

  return ffn.parsearCrudos(crudos, undefined, f.consulta);
}

async function buscarAO3(plan, f) {
  const { pedirHTMLConNavegador } = require('../scrapers/ao3-pedir.js');
  return require('../scrapers/ao3.js').resultadosDeHtml(await pedirHTMLConNavegador(plan.url), f.sinCrossovers === true);
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
  if (!plan.url) return { plan, obras: [], aviso: `${fuente} necesita una consulta o un fandom para buscar.` };
  const crudas = await buscadores[fuente](plan, f, { pagina });
  return { plan, obras: aplicarEnMemoria(crudas, f, plan.memoria) };
}

module.exports = { buscarEnSitio, BUSCADORES, nombresDePareja };
