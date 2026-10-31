const { leer, writeDB } = require('./nucleo.js');

async function anotarLecturaMedida(palabras, ms) {
  const datos = await leer();
  const { anotarLectura } = require('../ritmo.js');
  const antes = datos.settings.lecturas || [];
  const despues = anotarLectura(antes, palabras, ms);
  if (despues !== antes) {
    datos.settings.lecturas = despues;
    await writeDB();
  }
  return despues.length;
}

async function getLecturas() {
  const datos = await leer();
  return datos.settings?.lecturas || [];
}

async function getSettings() {
  const datos = await leer();
  return datos.settings || require('../ajustes-por-defecto.js').ajustesPorDefecto();
}

let colaDeAjustes = Promise.resolve();

const CLAVES_CIFRADAS = ['claveIA', 'claveDeepSeek'];

function updateSettings(newSettings) {
  colaDeAjustes = colaDeAjustes.then(
    () => guardarAjustes(newSettings),
    () => guardarAjustes(newSettings)
  );
  return colaDeAjustes;
}

async function guardarAjustes(newSettings) {
  const datos = await leer();

  let entrada = newSettings;
  for (const campo of CLAVES_CIFRADAS) {
    if (entrada && Object.prototype.hasOwnProperty.call(entrada, campo)) {
      const { paraGuardar } = require('../clave.js');
      entrada = { ...entrada, [campo]: paraGuardar(entrada[campo]) };
    }
  }

  datos.settings = { ...datos.settings, ...entrada };
  await writeDB();
  return datos.settings;
}

async function getConfigIA() {
  const s = await getSettings();
  const { POR_DEFECTO } = require('../proveedores-ia.js');
  const proveedor = s.proveedorIA || POR_DEFECTO;
  return {
    proveedor,
    clave: (await claveUtilizable(s)).clave,
    modelo: s.modeloIA || '',
    direccion: s.direccionIA || ''
  };
}

const CLAVE_DEL_PROVEEDOR = { gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' };

async function claveUtilizable(s) {
  const { paraUsar, estaCifrada } = require('../clave.js');
  const deAjustes = paraUsar(s.claveIA);
  if (deAjustes) return { clave: deAjustes, deDonde: 'ajustes', ilegible: false };
  const ilegible = estaCifrada(s.claveIA);
  const nombre = CLAVE_DEL_PROVEEDOR[s.proveedorIA || require('../proveedores-ia.js').POR_DEFECTO];
  let delFichero = '';
  if (nombre) { try { delFichero = await require('../claves-locales.js').clave(nombre); } catch {  } }
  return { clave: delFichero, deDonde: delFichero ? 'fichero' : null, ilegible };
}

async function claveDeepSeekUtilizable(s) {
  s = s || await getSettings();
  const { paraUsar, estaCifrada } = require('../clave.js');
  const deAjustes = paraUsar(s.claveDeepSeek);
  if (deAjustes) return { clave: deAjustes, deDonde: 'ajustes', ilegible: false };
  let delFichero = '';
  try { delFichero = await require('../claves-locales.js').clave('DEEPSEEK_API_KEY'); } catch {  }
  return { clave: delFichero, deDonde: delFichero ? 'fichero' : null, ilegible: estaCifrada(s.claveDeepSeek) };
}

async function getSettingsParaInterfaz() {
  const s = await getSettings();
  const { claveIA, claveDeepSeek, ...resto } = s;
  const { estadoDelCifrado, estaCifrada } = require('../clave.js');
  const cifrado = estadoDelCifrado();
  const util = await claveUtilizable(s);
  const deepseek = await claveDeepSeekUtilizable(s);
  return {
    ...resto,
    tieneClaveDeepSeek: !!deepseek.clave,
    claveDeepSeekOrigen: deepseek.deDonde,
    claveDeepSeekIlegible: deepseek.ilegible,

    tieneClaveIA: !!util.clave,
    claveIAOrigen: util.deDonde,
    claveIAIlegible: util.ilegible,
    claveIACifrada: estaCifrada(claveIA),
    cifradoDisponible: cifrado.disponible,
    cifradoMotivo: cifrado.motivo
  };
}

module.exports = {
  anotarLecturaMedida,
  getLecturas,
  getSettings,
  updateSettings,
  getConfigIA,
  getSettingsParaInterfaz,
  claveUtilizable,
  claveDeepSeekUtilizable,
  CLAVE_DEL_PROVEEDOR
};
