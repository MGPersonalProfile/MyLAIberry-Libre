const { aTexto } = require('./pdf-capitulos.js');

const MODELO = 'deepseek-flash';
const CARACTERES_POR_TROZO = 6000;
const A_LA_VEZ = 3;

const INSTRUCCIONES = [
  'Eres maquetador de libros. Te doy los párrafos de un capítulo sacados de un PDF, en JSON.',
  'La paginación los ha estropeado: hay párrafos partidos en dos, párrafos distintos pegados,',
  'números de página y cabeceras sueltas, y palabras cortadas con guion.',
  'Devuelve SOLO un objeto JSON con la clave "parrafos": la lista de párrafos arreglados. Puedes:',
  '- unir párrafos partidos y separar los pegados (cada intervención de diálogo, su párrafo);',
  '- quitar números de página, cabeceras y pies que se colaron;',
  '- unir palabras cortadas con guion;',
  '- conservar o poner <em> y </em> en lo que va en cursiva.',
  'NO cambies, añadas, traduzcas ni corrijas ninguna palabra: el texto tiene que ser el mismo.'
].join('\n');

const SE_PUEDE_QUITAR = /[0-9‐‑‒–-]/;
const sinEspacios = (html) => aTexto(html).replace(/\s+/g, '');

function mismoTexto(entrada, salida) {
  const a = sinEspacios(entrada.join(' '));
  const b = sinEspacios(salida.join(' '));
  if (!b.length) return false;
  let i = 0;
  for (const letra of b) {
    while (i < a.length && a[i] !== letra) {
      if (!SE_PUEDE_QUITAR.test(a[i])) return false;
      i++;
    }
    if (i >= a.length) return false;
    i++;
  }
  return [...a.slice(i)].every(c => SE_PUEDE_QUITAR.test(c));
}

const soloCursivas = (html) => String(html)
  .replace(/&(?!(amp|lt|gt);)/g, '&amp;')
  .replace(/<(?!\/?em>)/g, '&lt;')
  .trim();

function leerRespuesta(contenido) {
  const t = String(contenido || '');
  const json = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  if (!Array.isArray(json.parrafos) || !json.parrafos.every(p => typeof p === 'string')) {
    throw new Error('respuesta sin párrafos');
  }
  return json.parrafos.map(soloCursivas).filter(Boolean);
}

function trozos(parrafos) {
  const salida = [[]];
  let largo = 0;
  for (const p of parrafos) {
    if (largo + p.length > CARACTERES_POR_TROZO && salida[salida.length - 1].length) {
      salida.push([]);
      largo = 0;
    }
    salida[salida.length - 1].push(p);
    largo += p.length;
  }
  return salida;
}

async function pulirTrozo(trozo, proveedor, modelo) {
  try {
    const { message } = await proveedor({
      model: modelo || MODELO,
      tools: [],
      messages: [
        { role: 'system', content: INSTRUCCIONES },
        { role: 'user', content: JSON.stringify({ parrafos: trozo }) }
      ]
    });
    const pulido = leerRespuesta(message.content);
    return mismoTexto(trozo, pulido) ? { parrafos: pulido, pulido: true } : { parrafos: trozo, pulido: false };
  } catch {
    return { parrafos: trozo, pulido: false };
  }
}

async function pulirCapitulos(capitulos, proveedor, alAvanzar = () => {}, modelo = MODELO) {
  const tareas = capitulos.flatMap((c, n) => trozos(c.parrafos).map(t => ({ n, t })));
  const resultados = new Array(tareas.length);
  let siguiente = 0;
  let hechos = 0;
  const obrero = async () => {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      resultados[i] = await pulirTrozo(tareas[i].t, proveedor, modelo);
      alAvanzar(++hechos, tareas.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, tareas.length) }, obrero));

  const salida = capitulos.map(c => ({ ...c, parrafos: [] }));
  tareas.forEach(({ n }, i) => salida[n].parrafos.push(...resultados[i].parrafos));
  return { capitulos: salida, pulidos: resultados.filter(r => r.pulido).length, total: tareas.length };
}

module.exports = { pulirCapitulos, mismoTexto, leerRespuesta, INSTRUCCIONES };
