const { parecido, autorLimpio, mismoAutorLimpio } = require('./buscar-en-todos.js');
const { claveDeObra } = require('./misma-obra.js');

const PARECIDO = 0.9;
const MAXIMO = 50;

const enCorto = (o) => ({
  id: String(o.id), titulo: o.title, autor: o.author, sitio: o.source || null,
  capitulos: o.totalChapters ?? null, descargados: o.downloadedChapters ?? null,
  capituloActual: Number.isFinite(o.currentChapter) ? o.currentChapter + 1 : null
});

const numeros = (t) => (String(t || '').match(/\d+/g) || []).map(Number).join(',');

const mismoAutorEstricto = (x, y) => !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 5 && mismoAutorLimpio(x, y)));

const clave = (url) => { try { return url ? claveDeObra(url) : null; } catch { return null; } };

function obrasRepetidas(lista) {
  const obras = (Array.isArray(lista) ? lista : []).filter(o => o && o.origen !== 'descubierta' && o.origen !== 'descartada');
  const claves = obras.map(o => clave(o.url));

  const autores = obras.map(o => autorLimpio(o.author));
  const pares = [];
  for (let i = 0; i < obras.length && pares.length < MAXIMO; i++) {
    for (let j = i + 1; j < obras.length && pares.length < MAXIMO; j++) {
      const a = obras[i], b = obras[j];
      const mismaDireccion = !!claves[i] && claves[i] === claves[j];
      const mismoTituloYAutor = !mismaDireccion && mismoAutorEstricto(autores[i], autores[j]) && numeros(a.title) === numeros(b.title) &&
        parecido(a.title, b.title) >= PARECIDO;
      if (mismaDireccion || mismoTituloYAutor) {
        pares.push({ obras: [enCorto(a), enCorto(b)], motivo: mismaDireccion ? 'la misma dirección' : 'el mismo título y el mismo autor' });
      }
    }
  }
  return {
    revisadas: obras.length, pares,
    ...(pares.length >= MAXIMO ? { aviso: `Sólo los ${MAXIMO} primeros pares.` } : {}),
    nota: 'No se ha tocado nada. Si el usuario quiere quedarse con una, fundir_obras (con su confirmación) le pasa lo que puso en la otra y aparta la otra sin borrarla: no uses borrar_obra para eso.'
  };
}

module.exports = { obrasRepetidas };
