const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const {
  getFanfics, getFanficById, updateProgress, getChapterContent, medirPalabras,
  saveScrollPosition, getScrollPosition, anotarLecturaMedida, getLecturas,
  getSettings, glosarioParaTraducir, getRecap, setRecap, getConfigIA,
  getTitulosTraducidos, setTitulosTraducidos
} = require('../db.js');
const { resumirCapitulo, aTextoPlano } = require('../recap.js');
const { palabrasPorMinuto, minutosRestantes, MEDIDAS_MINIMAS } = require('../ritmo.js');
const { resumirConModelo } = require('../resumen-ia.js');
const { queFalta: queFaltaIA } = require('../proveedores-ia.js');
const { tieneTraduccion, rutaTraduccion, traducirTitulos } = require('../translate.js');
const traduccion = require('../traduccion-anticipada.js');
const { dirDeFanfic } = require('../rutas.js');
const { enHilo } = require('../en-hilo.js');

function posicionValida(p) {
  const numero = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (numero(p)) return p;
  if (!p || typeof p !== 'object' || !numero(p.px)) return null;
  const a = p.ancla;
  if (a == null) return { px: p.px, ancla: null };
  if (!Number.isInteger(a.indice) || a.indice < 0 || !Number.isInteger(a.total) || a.total < 1
    || !numero(a.fraccion) || a.fraccion > 1) return null;
  return { px: p.px, ancla: { indice: a.indice, fraccion: a.fraccion, total: a.total } };
}

function faltaParaElModelo(configIA) {
  const falta = queFaltaIA(configIA);
  if (!falta) return null;

  return {
    status: 'error',
    codigo: falta,
    message: falta === 'sin-direccion'
      ? 'Falta la dirección del servidor, en Ajustes'
      : falta === 'sin-modelo'
        ? 'Falta decir qué modelo usar, en Ajustes'
        : 'No hay clave configurada en Ajustes'
  };
}

const huellaDe = (html) => require('crypto').createHash('sha256').update(html).digest('hex').slice(0, 16);

function vigente(guardado, huella) {
  if (!guardado) return null;
  if (guardado.huella) return guardado.huella === huella ? guardado : null;
  return guardado.origen === 'modelo' ? guardado : null;
}

async function resumenDelModelo({ id, i, clave, html, glosario, idioma, configIA, huella }) {
  try {
    const texto = await resumirConModelo(
      aTextoPlano(html),
      idioma,
      configIA,
      glosario.map(g => g.termino)
    );
    await setRecap(id, i, clave, texto, 'modelo', huella);
    return { status: 'ok', texto, origen: 'modelo', cacheado: false };
  } catch (err) {
    const local = resumirCapitulo(html, glosario, 3);
    return { status: 'error', codigo: 'fallo-modelo', message: err.message, texto: local, origen: 'local' };
  }
}

function registrar() {
  ipcMain.handle('update-progress', async (event, id, currentChapter) => {
    const r = await updateProgress(id, currentChapter);

    const ajustes = await getSettings();
    if (ajustes?.autoTranslate !== false && ajustes?.lang) {
      traduccion.encolar(id, [currentChapter, currentChapter + 1], ajustes.lang);
    }
    return r;
  });

  ipcMain.handle('get-chapter-content', async (event, id, chapterIndex) => {
    return await getChapterContent(id, chapterIndex);
  });

  ipcMain.handle('check-repeated-chapters', async (event, id, total) => {
    try {
      const n = Math.max(0, Math.min(20000, Math.floor(Number(total)) || 0));
      return { status: 'ok', ...await enHilo('repetidos-en-carpeta', { dir: dirDeFanfic(id), n }) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('search-in-work', async (event, id, texto, hasta, idioma) => {
    const buscado = String(texto || '').trim();
    if (!buscado || buscado.length > 200) return { status: 'error', message: 'Escribe de 1 a 200 caracteres.' };
    try {
      const n = Math.max(0, Math.min(20000, Math.floor(Number(hasta)) || 0));
      const lengua = /^[a-z]{2,8}$/.test(String(idioma || '')) ? idioma : null;
      return { status: 'ok', ...await enHilo('buscar-en-carpeta', { dir: dirDeFanfic(id), buscado, n, idioma: lengua }) };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  });

  ipcMain.handle('save-scroll-position', async (event, id, chapterIndex, position) => {
    const valida = posicionValida(position);
    if (valida === null) return { status: 'error', message: 'Posición de lectura no válida' };
    return await saveScrollPosition(id, chapterIndex, valida);
  });

  ipcMain.handle('get-scroll-position', async (event, id, chapterIndex) => {
    return await getScrollPosition(id, chapterIndex);
  });

  ipcMain.handle('log-reading', async (event, fanficId, chapterIndex, ms) => {
    const archivo = path.join(dirDeFanfic(String(fanficId)), `chapter_${Number(chapterIndex)}.html`);
    if (!fs.existsSync(archivo)) return { status: 'ok', ignorado: true };

    const palabras = aTextoPlano(fs.readFileSync(archivo, 'utf-8')).split(/\s+/).length;
    const medidas = await anotarLecturaMedida(palabras, ms);
    return { status: 'ok', medidas };
  });

  ipcMain.handle('abrir-obra-en-pantalla', async (event, fanficId, { leer = true } = {}) => {
    const obra = await getFanficById(String(fanficId));
    if (!obra) return { status: 'error', message: 'Esa obra no está en la biblioteca.' };
    const { avisar, traerAlFrente } = require('../ventana.js');
    traerAlFrente();
    avisar('abrir-obra', { fanficId: String(obra.id), leer: !!leer });
    return { status: 'ok', abierta: obra.title, para: leer ? 'leer' : 'ficha', capitulo: (obra.currentChapter || 0) + 1 };
  });

  ipcMain.handle('get-reading-pace', async (event, fanficId) => {
    const lecturas = await getLecturas();
    const ppm = palabrasPorMinuto(lecturas);
    if (!ppm) return { ppm: null, medidas: lecturas.length, faltan: MEDIDAS_MINIMAS - lecturas.length };

    if (fanficId) await medirPalabras(String(fanficId)).catch(() => {});

    const obra = fanficId ? await getFanficById(String(fanficId)) : null;
    return {
      ppm,
      medidas: lecturas.length,
      restantes: obra ? minutosRestantes(obra, lecturas) : null
    };
  });

  ipcMain.handle('get-recap', async (event, fanficId, chapterIndex, opciones = {}) => {
    const id = String(fanficId);
    const i = Number(chapterIndex);
    const conModelo = !!opciones?.conModelo;

    const rehacer = !!opciones?.rehacer;

    const ajustes = await getSettings();
    const idioma = ajustes?.lang || 'es';
    const dir = dirDeFanfic(id);

    const leeTraducido = !!ajustes?.readTranslated && tieneTraduccion(dir, i, idioma);
    const clave = leeTraducido ? idioma : 'original';

    const archivo = leeTraducido
      ? rutaTraduccion(dir, i, idioma)
      : path.join(dir, `chapter_${i}.html`);
    if (!fs.existsSync(archivo)) {
      return { status: 'error', message: 'Ese capítulo no está descargado' };
    }
    const html = fs.readFileSync(archivo, 'utf-8');
    const huella = huellaDe(html);

    const guardado = vigente(await getRecap(id, i, clave), huella);

    if (!rehacer && guardado && (!conModelo || guardado.origen === 'modelo')) {
      return { status: 'ok', ...guardado, cacheado: true };
    }
    const glosario = await glosarioParaTraducir(id);

    if (!conModelo) {
      const texto = resumirCapitulo(html, glosario, 3);
      if (!texto) return { status: 'ok', texto: '', origen: 'ninguno' };
      await setRecap(id, i, clave, texto, 'local', huella);
      return { status: 'ok', texto, origen: 'local', cacheado: false };
    }

    const configIA = await getConfigIA();
    const falta = faltaParaElModelo(configIA);
    if (falta) return falta;

    return resumenDelModelo({ id, i, clave, html, glosario, idioma, configIA, huella });
  });

  ipcMain.handle('get-chapter-titles', async (event, fanficId) => {
    const id = String(fanficId);
    const ajustes = await getSettings();
    const idioma = ajustes?.lang || 'es';

    const obra = (await getFanfics()).find(f => String(f.id) === id);
    const originales = (obra?.chapterList || []).map(c => c?.title || '');
    if (!originales.length) return { status: 'ok', titulos: [], idioma };

    const guardados = await getTitulosTraducidos(id, idioma);
    if (guardados && guardados.length === originales.length) {
      return { status: 'ok', titulos: guardados, idioma, cacheado: true };
    }

    try {
      const titulos = await traducirTitulos(originales, idioma, await glosarioParaTraducir(id));
      await setTitulosTraducidos(id, idioma, titulos);
      return { status: 'ok', titulos, idioma, cacheado: false };
    } catch (err) {

      return { status: 'error', message: err.message, titulos: originales, idioma };
    }
  });

}

module.exports = { registrar, vigente };
