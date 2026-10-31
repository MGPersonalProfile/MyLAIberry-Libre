const fs = require('fs');
const path = require('path');
const { exigirCapitulo, textoPlano, huella } = require('./capitulo-valido.js');

const AVISO_AO3 = /Archive of Our Own \(AO3\), users can create/;

const TOPE_DE_AVISO = 4000;

const TRADUCCION = /^chapter_(\d+)\.[a-z]{2,8}\.html$/;

function esBasura(html, huellaAnterior) {
  if (Buffer.byteLength(html) <= TOPE_DE_AVISO && AVISO_AO3.test(html)) return true;
  try { exigirCapitulo(html, { anterior: huellaAnterior }); return false; }
  catch (err) { return !!err.capituloInvalido; }
}

function limpiarAvisosDeUnaObra(dir) {
  let ficheros;
  try { ficheros = fs.readdirSync(dir); } catch { return 0; }

  const traducciones = new Map();
  for (const nombre of ficheros) {
    const m = TRADUCCION.exec(nombre);
    if (!m) continue;
    if (!traducciones.has(m[1])) traducciones.set(m[1], []);
    traducciones.get(m[1]).push(nombre);
  }

  let tirados = 0;

  const capitulos = ficheros.map(n => /^chapter_(\d+)\.html$/.exec(n)).filter(Boolean)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  let anterior = { indice: -2, huella: null };
  for (const m of capitulos) {
    const nombre = m[0];
    const ruta = path.join(dir, nombre);
    try {
      const html = fs.readFileSync(ruta, 'utf-8');
      if (!esBasura(html, anterior.indice === Number(m[1]) - 1 ? anterior.huella : null)) {
        anterior = { indice: Number(m[1]), huella: huella(textoPlano(html)) };
        continue;
      }
      fs.unlinkSync(ruta);
      tirados++;

      for (const otro of traducciones.get(m[1]) || []) {
        fs.unlinkSync(path.join(dir, otro));
      }
    } catch {  }
  }
  return tirados;
}

module.exports = { limpiarAvisosDeUnaObra, esBasura };

function ocultarAntirroboDeUnaObra(dir) {
  const { ocultarAntirrobo } = require('./capitulo-valido.js');
  let ficheros;
  try { ficheros = fs.readdirSync(dir); } catch { return 0; }
  let limpiados = 0;
  for (const nombre of ficheros.filter(n => /^chapter_\d+(\.[a-z]{2,8})?\.html$/.test(n))) {
    const ruta = path.join(dir, nombre);
    try {
      const html = fs.readFileSync(ruta, 'utf-8');
      const limpio = ocultarAntirrobo(html);
      if (limpio === html) continue;
      fs.writeFileSync(`${ruta}.tmp`, limpio);
      fs.renameSync(`${ruta}.tmp`, ruta);
      limpiados++;
    } catch {  }
  }
  return limpiados;
}

module.exports.ocultarAntirroboDeUnaObra = ocultarAntirroboDeUnaObra;

const TEMPORAL = /^chapter_\d+(\.[a-z]{2,8})?\.html\.[0-9a-f-]{36}\.tmp$/;
function limpiarTemporalesDeUnaObra(dir, ahora = Date.now()) {
  let ficheros;
  try { ficheros = fs.readdirSync(dir); } catch { return 0; }
  let quitadas = 0;
  for (const nombre of ficheros.filter(n => TEMPORAL.test(n))) {
    try {
      const ruta = path.join(dir, nombre);
      if (ahora - fs.statSync(ruta).mtimeMs < 10 * 60 * 1000) continue;
      fs.unlinkSync(ruta);
      quitadas++;
    } catch {  }
  }
  return quitadas;
}

module.exports.limpiarTemporalesDeUnaObra = limpiarTemporalesDeUnaObra;
