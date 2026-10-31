const {
  queFalta,
  construirPeticion,
  leerRespuesta,
  vinoCortada,
  mensajeDeError
} = require('./proveedores-ia.js');

const TOPE_RESPUESTA = 4000;

const EXPLICACION = {
  'sin-clave': 'No hay clave configurada en Ajustes',
  'sin-modelo': 'Falta decir qué modelo usar, en Ajustes',
  'sin-direccion': 'Falta la dirección del servidor, en Ajustes'
};

async function resumirConModelo(texto, idioma, config = {}, nombres = []) {
  const falta = queFalta(config);
  if (falta) {
    const err = new Error(EXPLICACION[falta] || 'Falta configurar el resumen mejorado');
    err.codigo = falta;
    throw err;
  }

  const enEspanol = idioma === 'es';
  const listaNombres = nombres.slice(0, 30).join(', ');

  const instruccion = enEspanol
    ? 'Resume este capítulo de ficción en español para alguien que retoma la obra después de semanas y necesita recordar por dónde iba. Cuenta los hechos EN ORDEN y cómo queda la situación al final del capítulo. Extiéndete: al menos 300 palabras. Sin valoraciones, sin analizar temas ni estilo y sin preámbulos: empieza directamente por el resumen.'
    : 'Summarise this fiction chapter for someone returning to the story after weeks who needs to remember where they left off. Tell the events IN ORDER and where things stand at the end of the chapter. Go into detail: at least 300 words. No commentary, no analysis of themes or style, no preamble: start straight into the recap.';

  const sobreNombres = listaNombres
    ? (enEspanol
        ? `\n\nEstos nombres se escriben así y no se traducen: ${listaNombres}.`
        : `\n\nThese names are spelled exactly like this: ${listaNombres}.`)
    : '';

  const prompt = `${instruccion}${sobreNombres}\n\n---\n\n${recortar(texto)}`;
  const { url, opciones } = construirPeticion(config, prompt, TOPE_RESPUESTA);

  let respuesta;
  try {
    respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(60000) });
  } catch (e) {

    const err = new Error(
      e.name === 'TimeoutError'
        ? 'El servicio tardó demasiado en responder.'
        : `No se pudo conectar con el servicio. ¿La dirección es correcta y hay conexión? (${e.message})`
    );
    err.codigo = 'sin-conexion';
    throw err;
  }

  if (!respuesta.ok) {

    const cuerpo = await respuesta.text().catch(() => '');
    const err = new Error(mensajeDeError(respuesta.status, cuerpo));
    err.codigo = `http-${respuesta.status}`;
    throw err;
  }

  const datos = await respuesta.json();
  const salida = leerRespuesta(config.proveedor, datos);

  if (vinoCortada(config.proveedor, datos)) {
    if (!salida) {
      const err = new Error('El modelo agotó su presupuesto pensando y no llegó a escribir. Prueba con otro modelo.');
      err.codigo = 'cortada';
      throw err;
    }
    return salida + '…';
  }

  if (!salida) throw new Error('El servicio contestó sin texto.');
  return salida;
}

function recortar(texto, tope = 100000) {
  if (texto.length <= tope) return texto;
  const mitad = Math.floor(tope / 2);
  return `${texto.slice(0, mitad)}\n\n[…]\n\n${texto.slice(-mitad)}`;
}

module.exports = { resumirConModelo };
