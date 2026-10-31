const fs = require('fs').promises;
const path = require('path');

function contarPalabras(html) {
  if (!html) return 0;
  const texto = require('./capitulo-valido.js').sinOculto(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return texto ? texto.split(' ').length : 0;
}

async function medirCarpeta(dir) {
  let ficheros;
  try {
    ficheros = await fs.readdir(dir);
  } catch {
    return { palabras: 0, capitulos: 0 };
  }

  const capitulos = ficheros.filter(f => /^chapter_\d+\.html$/.test(f));
  let palabras = 0;
  for (const nombre of capitulos) {
    try {
      palabras += contarPalabras(await fs.readFile(path.join(dir, nombre), 'utf-8'));
    } catch {

    }
  }
  return { palabras, capitulos: capitulos.length };
}

function palabrasDeLaObra(obra) {
  if (!obra) return null;
  if (obra.wordCount > 0) return obra.wordCount;

  const medidas = obra.palabrasMedidas || 0;
  const capitulos = obra.capitulosMedidos || 0;
  if (!medidas || !capitulos) return null;

  const declarados = obra.totalChapters || (obra.chapterList || []).length || 0;
  const total = Math.max(declarados, capitulos);
  return Math.round((medidas / capitulos) * total);
}

module.exports = { contarPalabras, medirCarpeta, palabrasDeLaObra };
