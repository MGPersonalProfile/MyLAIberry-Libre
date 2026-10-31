const cola = require('../cola.js');
const { getFanfics, getFondos, guardarFondos } = require('../db.js');
const { buscarFondos, limpiarFandom } = require('../fondos.js');
const ETQ = require('../etiquetas.js');

function fandomDe(obra) {
  const t = (obra?.tags || []).find(x => x.category === ETQ.FANDOM);
  return t?.name || '';
}

async function buscarFondosDeFandom({ fandom }) {
  const { imagenes, escalones } = await buscarFondos(fandom, { cuantos: 4 });
  const guardadas = await guardarFondos(fandom, imagenes);

  const recorrido = escalones.map(e => `${e.escalon} ${e.aceptadas}/${e.candidatas}`).join(' · ');
  console.log(`[Fondos] "${fandom}": ${guardadas} imagen(es) — ${recorrido || 'sin candidatas'}`);
}

async function completarFandomsQueFaltan() {
  const sinFandom = (await getFanfics()).filter(f =>
    f.url &&
    f.origen !== 'descartada' &&
    !(f.tags || []).some(t => t.category === ETQ.FANDOM)
  );

  await cola.encolarVarias(
    'comprobar-capitulos',
    sinFandom.slice(0, 10).map(o => ({ fanficId: String(o.id) }))
  );
  if (sinFandom.length > 0) {
    console.log(`[Fondos] ${sinFandom.length} obra(s) sin fandom; releyendo su índice para averiguarlo.`);
  }
}

async function encolarFondosPendientes() {
  const yaBuscados = await getFondos();
  const pendientes = new Set();

  for (const obra of await getFanfics()) {
    if (obra.origen === 'descartada') continue;
    const fandom = fandomDe(obra);

    const clave = limpiarFandom(fandom);
    if (clave && !(clave in yaBuscados)) pendientes.add(clave);
  }

  await cola.encolarVarias('buscar-fondos', [...pendientes].map(fandom => ({ fandom })));
  if (pendientes.size > 0) {
    console.log(`[Fondos] ${pendientes.size} fandom(s) sin arte todavía; en cola.`);
  }
}

module.exports = {
  fandomDe,
  buscarFondosDeFandom,
  completarFandomsQueFaltan,
  encolarFondosPendientes
};
