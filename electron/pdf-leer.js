const { pathToFileURL } = require('url');

let cargado = null;
function pdfjs() {
  if (!cargado) {
    const ruta = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    cargado = import(pathToFileURL(ruta).href);
  }
  return cargado;
}

const MISMA_LINEA = 2;

function nombreDeFuente(pagina, id) {
  try {
    return pagina.commonObjs.has(id) ? String(pagina.commonObjs.get(id)?.name || '') : '';
  } catch {
    return '';
  }
}

function conEspacios(ts) {
  return ts.map((t, i) => {
    const antes = ts[i - 1];
    const hueco = antes && t.x - (antes.x + (antes.ancho || 0)) > t.tam * 0.15;
    const yaHay = antes && (/\s$/.test(antes.texto) || /^\s/.test(t.texto));
    return { texto: (hueco && !yaHay ? ' ' : '') + t.texto, cursiva: t.cursiva, negrita: t.negrita };
  });
}

function agruparEnLineas(trozos) {
  const lineas = [];
  for (const t of [...trozos].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const linea = lineas.find(l => Math.abs(l.y - t.y) <= MISMA_LINEA);
    if (linea) linea.trozos.push(t);
    else lineas.push({ y: t.y, trozos: [t] });
  }
  return lineas.map(({ y, trozos: ts }) => {
    ts.sort((a, b) => a.x - b.x);
    return {
      y,
      x: ts[0].x,
      tam: Math.max(...ts.map(t => t.tam)),
      trozos: conEspacios(ts),
      texto: conEspacios(ts).map(t => t.texto).join('').replace(/\s+/g, ' ').trim()
    };
  }).filter(l => l.texto);
}

async function trozosDePagina(pagina) {

  await pagina.getOperatorList();
  const contenido = await pagina.getTextContent();
  return contenido.items
    .filter(it => typeof it.str === 'string' && it.str !== '')
    .map(it => {
      const fuente = nombreDeFuente(pagina, it.fontName);
      return {
        texto: it.str,
        x: it.transform[4],
        y: it.transform[5],
        ancho: it.width || 0,
        tam: Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10,
        cursiva: /italic|oblique/i.test(fuente),
        negrita: /bold|black|heavy/i.test(fuente)
      };
    });
}

async function leerPdf(buffer) {
  const { getDocument } = await pdfjs();
  const tarea = getDocument({
    data: new Uint8Array(buffer),

    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0
  });
  const doc = await tarea.promise;
  try {
    const info = (await doc.getMetadata().catch(() => null))?.info || {};
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const alto = pagina.view[3] - pagina.view[1];
      paginas.push({ alto, lineas: agruparEnLineas(await trozosDePagina(pagina)) });
      pagina.cleanup();

      await new Promise(r => setImmediate(r));
    }
    return { titulo: String(info.Title || '').trim(), autor: String(info.Author || '').trim(), paginas };
  } finally {
    await tarea.destroy();
  }
}

module.exports = { leerPdf, agruparEnLineas };
