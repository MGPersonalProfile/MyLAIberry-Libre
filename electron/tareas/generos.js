const fs = require('fs');
const path = require('path');

const { getFanfics, getFanficById, setGenerosCrudos, setGenerosDecididosEnLote, proponerGenero } = require('../db.js');
const { aTextoPlano } = require('../recap.js');
const { perfilDeGustos, ordenarPorAfinidad } = require('../afinidad.js');
const clasificador = require('../clasificador.js');
const GEN = require('../genero.js');
const { avisar } = require('../ventana.js');
const { dirDeFanfic } = require('../rutas.js');

let vectoresDeGenerosCache = null;
async function vectoresDeGeneros() {
  if (!vectoresDeGenerosCache) {
    vectoresDeGenerosCache = await clasificador.vectorizar(GEN.GENEROS.map(g => g.frase));
  }
  return vectoresDeGenerosCache;
}

async function consolidarGeneros() {
  const obras = (await getFanfics()).filter(o => Array.isArray(o.generosCrudos) && o.generosCrudos.length);
  if (obras.length < 5) return;

  const refs = GEN.calcularReferencias(obras.map(o => o.generosCrudos));

  const decisiones = obras.map(obra => {
    const z = GEN.tipificar(obra.generosCrudos, refs);
    const { seguros, propuestos } = GEN.decidir(z, { descartados: obra.generosDescartados || [] });
    return { id: String(obra.id), seguros, propuestos };
  });
  await setGenerosDecididosEnLote(decisiones);

  avisar('generos-actualizados', { obras: obras.length });
}

async function clasificarGenero({ fanficId }) {
  const id = String(fanficId);
  const obra = await getFanficById(id);
  if (!obra) return;

  const dir = dirDeFanfic(id);
  let texto = obra.synopsis ? obra.synopsis + ' ' : '';
  for (let i = 0; i < 3; i++) {
    const archivo = path.join(dir, `chapter_${i}.html`);
    if (fs.existsSync(archivo)) texto += ' ' + aTextoPlano(fs.readFileSync(archivo, 'utf-8'));
  }

  const trozos = GEN.trocear(texto);
  if (!trozos.length) return;

  const vTrozos = await clasificador.vectorizar(trozos);
  await setGenerosCrudos(id, GEN.puntuar(vTrozos, await vectoresDeGeneros(), { textoCompleto: texto }));
  await consolidarGeneros();

  console.log(`[Género] "${obra.title}" clasificada sobre ${trozos.length} trozos.`);
}

const AFINIDAD_MINIMA = 12;

const FRACCION_DE_LA_MEJOR = 0.6;

const TOPE_VECINAS = 3;

async function propagarGenero(idOrigen, nombre) {
  const todas = await getFanfics();
  const origen = todas.find(o => String(o.id) === String(idOrigen));
  if (!origen) return 0;

  const bajo = String(nombre).toLowerCase();
  const candidatas = todas.filter(o =>
    String(o.id) !== String(idOrigen) &&
    o.origen !== 'descartada' &&
    !(o.tags || []).some(t => t.category === 'genre' && String(t.name).toLowerCase() === bajo) &&
    !(o.generosDescartados || []).some(g => g.toLowerCase() === bajo)
  );
  if (!candidatas.length) return 0;

  const vecinas = ordenarPorAfinidad(candidatas, perfilDeGustos([origen]));
  const mejor = vecinas[0]?.afinidad || 0;
  if (mejor < AFINIDAD_MINIMA) return 0;

  const elegidas = vecinas
    .filter(v => v.afinidad >= mejor * FRACCION_DE_LA_MEJOR)
    .slice(0, TOPE_VECINAS);

  let hechas = 0;
  for (const v of elegidas) {

    if (await proponerGenero(String(v.id), nombre, v.porque || [])) hechas++;
  }

  if (hechas > 0) {
    console.log(`[Género] "${nombre}" propuesto a ${hechas} obra(s) parecidas a "${origen.title}".`);
    avisar('generos-actualizados', { propagadas: hechas });
  }
  return hechas;
}

module.exports = {
  vectoresDeGeneros,
  consolidarGeneros,
  clasificarGenero,
  propagarGenero
};
