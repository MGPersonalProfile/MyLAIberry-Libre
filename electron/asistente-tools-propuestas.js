function herramientasDePropuestas(add, services) {
  add('proponer_obras', 'Deja obras encontradas con buscar_obras en Descubrimientos → «Por decidir», para que el usuario las acepte o descarte: se baja sólo su primer capítulo y, si no la descarta en el plazo (24 h salvo que el usuario haya cambiado plazoPropuestasHoras en Ajustes, o pida otro: horas), se descarga entera sola. Úsala cuando pida «tráemelas», «déjamelas en descubrimientos» o «guárdamelas para decidir». urls: las que devolvió buscar_obras (no inventes ni reescribas ninguna). motivo: una frase de por qué se propone (la petición y los filtros). Dile el plazo y que puede descartarlas desde Descubrimientos.',
    {
      urls: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'string', minLength: 8, maxLength: 500 } },
      motivo: { type: 'string', maxLength: 300 },
      horas: { type: 'integer', minimum: 1, maximum: 168 }
    }, args => services.proponer(args), ['urls']);
  add('leer_primer_capitulo', 'Lee el primer capítulo de una obra de Descubrimientos (propuesta o descubierta) SIN pasarla a la biblioteca, para «léete el primero y dime qué tal». obra: su url, título o id. Devuelve el texto del capítulo 1 (recortado si es muy largo). Da una primera impresión sin spoilers: planteamiento, tono, ritmo y escritura, y si encaja con lo que pidió. Si devuelve error, di que no lo has podido leer: no inventes la impresión. Para un resultado de búsqueda que no esté en Descubrimientos, proponlo antes con proponer_obras.',
    { obra: { type: 'string', minLength: 1, maxLength: 500 } }, args => services.primerCapitulo(args), ['obra']);
  add('investigar_propuesta', 'Amplía la evidencia de UNA propuesta de Descubrimientos o candidata de búsqueda, sin descargar la obra. nivel: ficha (comprueba metadatos), primer_capitulo (comprueba el texto inicial) o analisis (valora tono, ritmo y compatibilidad con IA). presupuesto: límite opcional de peticiones o gasto. Respeta el ritmo por sitio y la caché disponible. Devuelve datos comprobados, evidencias, interpretaciones, restricciones y coste real.',
    {
      obra: { type: 'string', minLength: 1, maxLength: 500 },
      nivel: { type: 'string', enum: ['ficha', 'primer_capitulo', 'analisis'] },
      presupuesto: {
        type: 'object',
        properties: {
          maxPeticiones: { type: 'integer', minimum: 0, maximum: 50 },
          maxLlamadasModelo: { type: 'integer', minimum: 0, maximum: 10 }
        }
      }
    }, args => services.investigarPropuesta(args), ['obra']);
}

module.exports = { herramientasDePropuestas };
