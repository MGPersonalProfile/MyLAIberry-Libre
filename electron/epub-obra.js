const fs = require('fs');
const path = require('path');

const { getFanficById, getSettings } = require('./db.js');
const { tieneTraduccion, rutaTraduccion } = require('./translate.js');
const { dirDeFanfic } = require('./rutas.js');

function capitulosParaElLibro(obra, dir, { enTraducido, idioma, total }) {
  const capitulos = [];

  for (let i = 0; i < total; i++) {
    const traducido = enTraducido && tieneTraduccion(dir, i, idioma);
    const archivo = traducido
      ? rutaTraduccion(dir, i, idioma)
      : path.join(dir, `chapter_${i}.html`);
    if (!fs.existsSync(archivo)) continue;

    capitulos.push({
      titulo: obra.chapterList?.[i]?.title || `Capítulo ${i + 1}`,
      html: fs.readFileSync(archivo, 'utf-8'),
      traducido
    });
  }

  return capitulos;
}

function portadaDelLibro(obra) {
  if (!obra.localCoverPath || !fs.existsSync(obra.localCoverPath)) return null;

  const ext = path.extname(obra.localCoverPath).toLowerCase();
  return {
    datos: fs.readFileSync(obra.localCoverPath),
    tipo: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  };
}

async function prepararEpub(fanficId, opciones = {}) {
  const id = String(fanficId);
  const obra = await getFanficById(id);
  if (!obra) return { status: 'error', message: 'No se encuentra esa obra' };

  const dir = dirDeFanfic(id);
  const ajustes = await getSettings();
  const idioma = ajustes?.lang || 'es';
  const enTraducido = opciones?.traducido ?? !!ajustes?.readTranslated;
  const total = obra.totalChapters || (obra.chapterList || []).length || 0;

  const capitulos = capitulosParaElLibro(obra, dir, { enTraducido, idioma, total });
  if (capitulos.length === 0) {
    return { status: 'error', message: 'No hay ningún capítulo descargado todavía' };
  }

  const { crearEpub, nombreSugerido } = require('./epub-escribir.js');
  const capitulosTraducidos = capitulos.filter(c => c.traducido).length;
  const libro = crearEpub({
    titulo: obra.title,
    autor: obra.author,
    idioma: enTraducido && capitulosTraducidos ? idioma : (obra.idiomaOriginal || 'und'),
    sinopsis: obra.synopsis,
    portada: portadaDelLibro(obra),
    capitulos,
    url: obra.url,
    etiquetas: (obra.tags || []).map(t => t.name).filter(Boolean).slice(0, 20)
  });

  return {
    status: 'ok',
    libro,
    nombre: nombreSugerido({ titulo: obra.title, autor: obra.author }),
    resumen: {
      capitulos: capitulos.length,
      total,
      traducido: enTraducido,
      idiomaOriginal: obra.idiomaOriginal || 'no consta',
      idiomaSolicitado: enTraducido ? idioma : null,

      ...(enTraducido ? { capitulosTraducidos } : {})
    }
  };
}

module.exports = { prepararEpub, capitulosParaElLibro, portadaDelLibro };
