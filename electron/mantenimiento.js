const fs = require('fs');
const path = require('path');

const cola = require('./cola.js');
const {
  getFanfics, updateDownloadCount, countChaptersOnDisk, setGlosario,
  marcarGlosarioResembrado, updateCoverUrl, setAutorUrl, setFuente, saveCoverLocally,
  updateLocalCoverPath, sellarPortada
} = require('./db.js');
const { aTextoPlano } = require('./recap.js');
const { portadaGrande, esPortadaGenerica } = require('./scrapers/ffn.js');
const { urlDeAutor } = require('./scrapers/index.js');
const { dirDeFanfic } = require('./rutas.js');
const { conDisco } = require('./barrera-disco.js');
const { limpiarAvisosDeUnaObra, ocultarAntirroboDeUnaObra, limpiarTemporalesDeUnaObra } = require('./limpiar-capitulos.js');

async function resembrarGlosarios() {
  const { sembrar } = require('./glosario.js');
  let tocados = 0;

  for (const obra of await getFanfics()) {
    if (obra.origen === 'descartada') continue;
    if (!(obra.tags || []).length && !(obra.downloadedChapters || 0)) continue;
    if (obra.glosarioResembrado) continue;

    const dir = dirDeFanfic(obra.id);
    let texto = '';
    for (let i = 0; i < 3; i++) {
      const archivo = path.join(dir, `chapter_${i}.html`);
      if (fs.existsSync(archivo)) texto += ' ' + aTextoPlano(fs.readFileSync(archivo, 'utf-8'));
    }

    const nuevo = sembrar(obra.tags, texto, obra.glosarioQuitados || []);
    await setGlosario(String(obra.id), nuevo);
    await marcarGlosarioResembrado(String(obra.id));
    tocados++;
  }

  if (tocados > 0) console.log(`[Glosario] ${tocados} obra(s) resembradas leyendo su texto.`);
}

async function ocultarAntirroboGuardado() {
  let ficheros = 0;
  for (const obra of await getFanfics()) {
    let dir;
    try { dir = dirDeFanfic(obra.id); } catch { continue; }
    ficheros += ocultarAntirroboDeUnaObra(dir);
    limpiarTemporalesDeUnaObra(dir);
  }
  if (ficheros) console.log(`[Reparación] Frases antipiratería que el sitio esconde, ocultas en ${ficheros} capítulo(s).`);
}

async function tirarCapitulosDeAviso() {
  let ficheros = 0;
  const obras = [];

  for (const obra of await getFanfics()) {
    let dir;
    try { dir = dirDeFanfic(obra.id); } catch { continue; }
    if (!fs.existsSync(dir)) continue;

    const tirados = limpiarAvisosDeUnaObra(dir);
    if (tirados > 0) {
      ficheros += tirados;
      obras.push(obra);
      await updateDownloadCount(obra.id, await countChaptersOnDisk(obra.id));
    }
  }

  if (ficheros === 0) return;
  console.log(`[Reparación] ${ficheros} "capítulo(s)" que eran basura (el aviso de AO3, el armazón de la web o repetidos), en ${obras.length} obra(s): borrados.`);

  await cola.encolarVarias('descargar-capitulos', obras.map(o => ({ fanficId: String(o.id) })));
}

async function descargarPortadasQueFaltan() {
  const pendientes = [];

  for (const obra of await getFanfics()) {
    if (obra.origen === 'descartada' || !obra.coverUrl) continue;
    const enDisco = obra.localCoverPath && fs.existsSync(obra.localCoverPath);
    if (enDisco && obra.localCoverUrl === obra.coverUrl) {

      if (!obra.localCoverAt) {
        const cuando = fs.statSync(obra.localCoverPath).mtimeMs;
        await sellarPortada(obra.id, Math.round(cuando));
      }
      continue;
    }
    pendientes.push(obra);
  }
  if (pendientes.length === 0) return;

  let bajadas = 0;
  for (const obra of pendientes) {
    const ruta = await saveCoverLocally(obra.id, obra.coverUrl);
    if (ruta) {
      await updateLocalCoverPath(obra.id, ruta, obra.coverUrl);
      bajadas++;
    }

    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[Portadas] ${bajadas} de ${pendientes.length} guardadas en disco.`);
}

async function limpiarDescubrimientos() {
  const SEIS_MESES = 182 * 24 * 3600 * 1000;
  const ahora = Date.now();
  let liberadas = 0;

  for (const f of await getFanfics()) {
    if (f.origen !== 'descubierta') continue;
    if (f.currentChapter > 0) continue;
    if (ahora - (f.addedAt || ahora) < SEIS_MESES) continue;
    if ((f.downloadedChapters || 0) === 0) continue;

    const dir = dirDeFanfic(f.id);
    try {
      for (const nombre of fs.readdirSync(dir)) {
        if (/^chapter_\d+\./.test(nombre)) fs.unlinkSync(path.join(dir, nombre));
      }
      await updateDownloadCount(f.id, 0);
      liberadas++;
    } catch {  }
  }

  if (liberadas > 0) {
    console.log(`[Limpieza] ${liberadas} descubrimiento(s) sin abrir en seis meses: texto borrado, ficha conservada.`);
  }
}

async function arreglarPortadasDeFFN(obras) {
  let arregladas = 0;
  for (const f of obras) {

    if (f.coverUrl && esPortadaGenerica(f.coverUrl)) { if (await updateCoverUrl(f.id, '')) arregladas++; continue; }
    const relativaDeFFN = /^\/image\/\d+\/\d+\/?$/.test(f.coverUrl || '')
      && /^https?:\/\/(?:www\.|m\.)?fanfiction\.net\//i.test(f.url || '');
    if (!f.coverUrl || (!f.coverUrl.includes('fanfiction.net/image/') && !relativaDeFFN)) continue;
    if (await updateCoverUrl(f.id, portadaGrande(f.coverUrl))) arregladas++;
  }
  if (arregladas > 0) {
    console.log(`[Portadas] ${arregladas} de FanFiction.net actualizadas a 180 px.`);
  }
  return arregladas;
}

const ALIAS_DE_FUENTE = { 'Webnovel.com': 'Webnovel' };

async function canonizarFuentes(obras) {
  let arregladas = 0;
  for (const f of obras) {
    const buena = ALIAS_DE_FUENTE[f.source];
    if (buena && await setFuente(f.id, buena)) arregladas++;
  }
  if (arregladas > 0) console.log(`[Fuentes] ${arregladas} obra(s) con el nombre de su sitio unificado.`);
  return arregladas;
}

async function canonizarAutores(obras) {
  let arregladas = 0;
  for (const f of obras) {
    if (!f.autorUrl) continue;
    const canonica = urlDeAutor(f.autorUrl);
    if (canonica && canonica !== f.autorUrl && await setAutorUrl(f.id, canonica)) arregladas++;
  }
  if (arregladas > 0) {
    console.log(`[Autores] ${arregladas} dirección(es) de autor puestas en su forma canónica.`);
  }
  return arregladas;
}

async function alArrancar() {
  const obras = await getFanfics();

  await arreglarPortadasDeFFN(obras);
  await canonizarAutores(obras);
  await canonizarFuentes(obras);

  await conDisco(limpiarDescubrimientos);

  await conDisco(tirarCapitulosDeAviso);

  await conDisco(ocultarAntirroboGuardado);

  await resembrarGlosarios();

  await descargarPortadasQueFaltan();
}

module.exports = {
  alArrancar,
  resembrarGlosarios,
  tirarCapitulosDeAviso,
  descargarPortadasQueFaltan,
  limpiarDescubrimientos,
  arreglarPortadasDeFFN,
  canonizarAutores,
  canonizarFuentes,
  ALIAS_DE_FUENTE
};
