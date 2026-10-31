const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const {
  getFanficById, getFanfics, getAssistantState, addFanfic, updateChapterList, saveChapterContent,
  updateDownloadCount, countChaptersOnDisk, firstMissingChapter, medirPalabras,
  saveCoverLocally, updateLocalCoverPath, getSettings, elegirCapitulos
} = require('../db.js');
const cola = require('../cola.js');
const { scrapeStory, urlDeAutor } = require('../scrapers/index.js');
const traduccion = require('../traduccion-anticipada.js');
const { avisar, ventana } = require('../ventana.js');
const { dirDeFanfic } = require('../rutas.js');
const { obraDeEpub, esDelDisco } = require('../epub-importar.js');
const { TECHO_DEL_FICHERO } = require('../epub.js');
const { obraDePdf } = require('../pdf-importar.js');

const capitulosGuardados = (n) => `${n} ${n === 1 ? 'capítulo guardado' : 'capítulos guardados'}`;
const { crearProveedor } = require('../asistente-proveedor.js');
const { conDisco } = require('../barrera-disco.js');
const { apartarCapitulos: apartarObra } = require('../reparar-obra.js');

function camposFrescos(fresh) {
  return {
    title: fresh.title,
    author: fresh.author,
    synopsis: fresh.synopsis,
    coverUrl: fresh.coverUrl,

    autorUrl: fresh.autorUrl ? (urlDeAutor(fresh.autorUrl) || fresh.autorUrl) : fresh.autorUrl,

    tags: fresh.tags,

    completa: fresh.completa,
    wordCount: fresh.wordCount,
    kudos: fresh.kudos,
    capitulosDePago: fresh.capitulosDePago,
    capitulosLibres: fresh.capitulosLibres,

    series: Array.isArray(fresh.series) && fresh.series.length ? fresh.series : undefined
  };
}

async function repararCapitulos(id, fresh) {
  if (!Array.isArray(fresh.chapterContents) || fresh.chapterContents.length === 0) return 0;

  const dir = dirDeFanfic(id);
  let reparados = 0;

  for (let i = 0; i < fresh.chapterContents.length; i++) {
    const nuevo = fresh.chapterContents[i];
    if (!nuevo || nuevo.length < 500) continue;
    const archivo = path.join(dir, `chapter_${i}.html`);
    const viejo = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf-8') : '';
    if (viejo === nuevo) continue;

    await saveChapterContent(id, i, nuevo);

    for (const idioma of ['es', 'en']) {
      const t = path.join(dir, `chapter_${i}.${idioma}.html`);
      if (fs.existsSync(t)) fs.unlinkSync(t);
    }
    reparados++;
  }

  if (reparados > 0) {
    await updateDownloadCount(id, await countChaptersOnDisk(id));

    await medirPalabras(id, { forzar: true }).catch(() => {});
    console.log(`[Reparación] "${fresh.title}": ${reparados} capítulo(s) reescritos.`);
  }
  return reparados;
}

function resumenDeRefresco(nuevos, reparados, total) {
  const partes = [];
  if (nuevos > 0) partes.push(`${nuevos} capítulo(s) nuevo(s)`);
  if (reparados > 0) partes.push(`${reparados} recuperado(s)`);
  return partes.length
    ? `${partes.join(' y ')}: ahora hay ${total}.`
    : `Sin novedades: siguen siendo ${total}.`;
}

function obraParaGuardar(storyData) {
  return {
    title: storyData.title,
    author: storyData.author,
    synopsis: storyData.synopsis,
    coverUrl: storyData.coverUrl || '',
    totalChapters: storyData.chapters ? storyData.chapters.length : 0,
    currentChapter: 0,
    progress: 0,
    url: storyData.url,
    source: storyData.source,
    ...(storyData.language || storyData.idiomaOriginal ? { idiomaOriginal: storyData.language || storyData.idiomaOriginal } : {}),
    chapterList: storyData.chapters,
    ...(storyData.needsChapterSelection === true ? { needsChapterSelection: true } : {}),
    tags: storyData.tags || [],
    wordCount: storyData.wordCount || 0,
    kudos: storyData.kudos || 0,

    ...(storyData.autorUrl ? { autorUrl: urlDeAutor(storyData.autorUrl) || storyData.autorUrl } : {}),

    ...(typeof storyData.completa === 'boolean' ? { completa: storyData.completa } : {}),

    ...(Array.isArray(storyData.series) && storyData.series.length ? { series: storyData.series } : {}),

    ...(typeof storyData.capitulosDePago === 'number'
      ? { capitulosDePago: storyData.capitulosDePago, capitulosLibres: storyData.capitulosLibres || 0 }
      : {})
  };
}

async function guardarCapitulosTraidos(id, contenidos) {
  for (let i = 0; i < contenidos.length; i++) {
    await saveChapterContent(id, i, contenidos[i]);
  }
  await updateDownloadCount(id, contenidos.length);
  await medirPalabras(id).catch(() => {});

  const ajustes = await getSettings();
  if (ajustes?.autoTranslate !== false && ajustes?.lang) {
    traduccion.encolar(id, [0, 1, 2], ajustes.lang);
  }
}

function bajarPortada(saved) {
  if (!saved.coverUrl) return;
  saveCoverLocally(saved.id, saved.coverUrl).then(async (localPath) => {
    if (localPath) {
      await updateLocalCoverPath(saved.id, localPath, saved.coverUrl);
      console.log(`[Backend] Portada guardada: ${localPath}`);
    }
  });
}

async function importarLibro(ruta, sendProgress, { proveedor = crearProveedor() } = {}) {
  sendProgress({ step: 'fetching', message: 'Leyendo el libro…' });

  if ((await fs.promises.stat(ruta)).size > TECHO_DEL_FICHERO) {
    throw new Error('Ese fichero pasa de 300 MB: no parece un libro.');
  }
  const datos = await fs.promises.readFile(ruta);
  const storyData = /\.pdf$/i.test(ruta)
    ? await obraDePdf(datos, ruta, {
      proveedor,

      modelo: (await getAssistantState())?.settings?.model,
      alAvanzar: (hechos, total) => sendProgress({ step: 'fetching', message: `Maquetando con DeepSeek… ${hechos} de ${total}` })
    })
    : await obraDeEpub(datos, ruta);

  sendProgress({ step: 'saving_metadata', message: 'Guardando metadatos...' });
  const saved = await addFanfic(obraParaGuardar(storyData));

  if (saved.totalChapters !== storyData.chapters.length) {
    const aviso = 'El libro ya estaba importado con otra división del índice. Se conserva esa copia y su progreso; no se sobrescriben capítulos ni traducciones.';
    sendProgress({ step: 'complete', message: aviso });
    return { status: 'success', data: saved, yaEstaba: true, aviso };
  }

  if (await countChaptersOnDisk(saved.id) >= storyData.chapterContents.length) {
    sendProgress({ step: 'complete', message: `«${saved.title}» ya estaba en tu biblioteca.` });
    return { status: 'success', data: saved, yaEstaba: true };
  }

  sendProgress({ step: 'saving_chapters', message: 'Guardando capítulos...' });
  await guardarCapitulosTraidos(saved.id, storyData.chapterContents);

  const sinRepaso = storyData.maquetado?.total > 0 && storyData.maquetado.pulidos === 0
    ? ' DeepSeek no pudo repasar la maquetación: queda la automática.' : '';
  sendProgress({ step: 'complete', message: `¡Importado! ${capitulosGuardados(storyData.chapterContents.length)}.${sinRepaso}` });
  return { status: 'success', data: saved };
}

function registrar() {

  let reanudar = null;
  let reanudaA = null;
  ipcMain.handle('queue-status', async () => {
    const porTipo = {};
    for (const t of await cola.pendientes()) porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1;
    return { status: 'ok', enMarcha: cola.enMarcha(), trabajandoAhora: cola.enCurso(), porTipo, reanudaA: cola.enMarcha() ? null : reanudaA };
  });
  ipcMain.handle('queue-pause', async (event, pausar) => {
    clearTimeout(reanudar); reanudar = null; reanudaA = null;
    if (pausar) {
      cola.parar();
      reanudaA = Date.now() + 2 * 60 * 60 * 1000;
      reanudar = setTimeout(() => { reanudar = null; reanudaA = null; cola.arrancar(); }, reanudaA - Date.now());
    } else await cola.arrancar();
    return { status: 'ok', enMarcha: cola.enMarcha(), reanudaA };
  });

  ipcMain.handle('importar-enlace-libro', async (event, url) => {
    try { return await require('../libro-enlace').importarEnlace(url, p => avisar('scrape-progress', { ...p, url })); }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('abrir-importador-web', async (event, url) => {
    try { return require('../importador-web').abrirImportador(url || undefined); }
    catch (e) { return { status: 'error', message: e.message }; }
  });
  ipcMain.handle('elegir-capitulos', async (event, fanficId, indices) => {
    try {
      const obra = await elegirCapitulos(fanficId, indices);
      await cola.encolar('descargar-capitulos', { fanficId: String(obra.id) });
      return { status: 'success', data: obra };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  });
  ipcMain.handle('importar-libro', async (event, opciones = {}) => {
    const sendProgress = (data) => avisar('scrape-progress', data);

    const rutaSugerida = typeof opciones?.rutaSugerida === 'string' ? opciones.rutaSugerida.slice(0, 500) : undefined;
    const { canceled, filePaths } = await dialog.showOpenDialog(ventana(), {
      title: 'Importar un libro',
      defaultPath: rutaSugerida,
      filters: [{ name: 'EPUB o PDF', extensions: ['epub', 'pdf'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths?.length) return { status: 'cancelled' };
    try {
      return await importarLibro(filePaths[0], sendProgress);
    } catch (error) {
      sendProgress({ step: 'error', message: `Error: ${error.message}` });
      return { status: 'error', message: error.message };
    }
  });

  ipcMain.handle('resume-download', async (event, fanficId) => {
    const id = String(fanficId);
    const fanfic = await getFanficById(id);
    if (!fanfic) return { status: 'error', message: 'Fanfic no encontrado' };
    if (fanfic.needsChapterSelection) return { status: 'error', message: 'Elige los capítulos en la ficha' };

    let lista = fanfic.chapterList;
    if (!Array.isArray(lista) || lista.length === 0) {
      const leido = await releerIndice(id);
      if (leido.status !== 'ok') return leido;
      lista = (await getFanficById(id)).chapterList || [];
    }

    const total = lista.length;
    const startFrom = await firstMissingChapter(id, total);
    if (startFrom >= total) {
      await updateDownloadCount(id, total);
      return { status: 'complete', message: 'Ya está completo', downloaded: total, total };
    }

    await cola.encolar('descargar-capitulos', { fanficId: id });
    return { status: 'queued', downloaded: startFrom, total };
  });

  ipcMain.handle('repair-work', async (event, fanficId) => {
    const id = String(fanficId);
    const fanfic = await getFanficById(id);
    if (!fanfic) return { status: 'error', message: 'Fanfic no encontrado' };
    if (esDelDisco(fanfic.url)) return { status: 'error', message: 'Esta obra viene de un fichero del disco: no hay ninguna web de la que volver a bajar sus capítulos' };
    if (fanfic.needsChapterSelection) return { status: 'error', message: 'Elige los capítulos en la ficha' };
    const total = Array.isArray(fanfic.chapterList) ? fanfic.chapterList.length : 0;
    if (!total) return { status: 'error', message: 'La obra no tiene índice de capítulos: busca capítulos nuevos primero' };

    if ((await cola.pendientes()).some(t => t.tipo === 'descargar-capitulos' && String(t.carga?.fanficId) === id)) {
      return { status: 'error', message: 'Esta obra se está descargando: repárala cuando termine.' };
    }
    const dir = dirDeFanfic(id);
    const plan = await require('../en-hilo.js').enHilo('plan-de-reparacion', { dir, n: total });
    if (!plan.aRehacer.length) {
      return { status: 'ok', ...plan, apartados: 0, message: 'No hay capítulos vacíos ni duplicados que rehacer.' };
    }

    const { apartados } = await conDisco(async () => apartarObra(dirDeFanfic(id), plan.aRehacer));
    await updateDownloadCount(id, await countChaptersOnDisk(id));
    const desde = (await firstMissingChapter(id, total)) + 1;
    await cola.encolar('descargar-capitulos', { fanficId: id });
    return {
      status: 'queued', ...plan, apartados, desdeCapitulo: desde,
      message: `Capítulos ${plan.aRehacer.join(', ')} apartados en «reparados/» (no se borra nada) y en cola para volver a bajarlos ` +
        `del sitio, desde el ${desde}.`
    };
  });

  ipcMain.handle('refresh-chapters', (event, fanficId) => releerIndice(String(fanficId)));

  ipcMain.handle('refresh-chapters-all', async () => ({
    status: 'ok', enCola: await require('../planificador.js').encolarRevisiones(await getFanfics(), Date.now(), { todas: true })
  }));

  async function releerIndice(id) {
    const fanfic = await getFanficById(id);
    if (!fanfic) return { status: 'error', message: 'Fanfic no encontrado' };
    if (!fanfic.url) return { status: 'error', message: 'Este fanfic no guarda su dirección de origen' };
    if (fanfic.needsChapterSelection) return { status: 'error', message: 'Elige los capítulos en la ficha' };
    if (esDelDisco(fanfic.url)) return { status: 'error', message: 'Esta obra viene de un fichero del disco: no tiene índice en ninguna web que releer' };

    const sendProgress = (data) => {
      avisar('download-progress', { fanficId: id, ...data });
    };

    try {
      sendProgress({ step: 'refreshing', message: 'Releyendo el índice…' });
      const fresh = await scrapeStory(fanfic.url, sendProgress);
      if (fresh.needsChapterSelection) throw new Error('El índice es ambiguo; se conservan los capítulos elegidos');

      if (!fresh.chapters || fresh.chapters.length === 0) {
        sendProgress({ step: 'error', message: 'No se encontró ningún capítulo' });
        return { status: 'error', message: 'El índice no devolvió capítulos' };
      }

      const res = await updateChapterList(id, fresh.chapters, camposFrescos(fresh));

      const reparados = res.conservado ? 0 : await conDisco(() => repararCapitulos(id, fresh));

      const nuevos = res.nuevos;

      sendProgress({
        step: 'complete',
        message: resumenDeRefresco(nuevos, reparados, res.after),
        downloaded: await countChaptersOnDisk(id),
        total: res.after
      });

      return { status: 'ok', before: res.before, after: res.after, nuevos, reparados };
    } catch (err) {
      sendProgress({ step: 'error', message: err.message });
      return { status: 'error', message: err.message };
    }
  }

  ipcMain.handle('scrape-story', async (event, url) => {
    console.log(`[Backend] Iniciando extracción para: ${url}`);

    const sendProgress = (data) => {
      avisar('scrape-progress', { ...data, url });
    };

    try {

      if (require('../libro-enlace').esEnlaceLibro(url)) return await require('../libro-enlace').importarEnlace(url, sendProgress);

      const storyData = await scrapeStory(url, sendProgress, { respaldoFicHub: true });

      sendProgress({ step: 'saving_metadata', message: 'Guardando metadatos...' });
      const saved = await addFanfic(obraParaGuardar(storyData));

      const traidos = storyData.chapterContents;
      if (saved.needsChapterSelection) {
        sendProgress({ step: 'complete', message: '¡Importado! Hay que elegir los capítulos en la ficha antes de descargarlos.' });
      } else if (traidos && traidos.length > 0) {
        sendProgress({ step: 'saving_chapters', message: 'Guardando capítulos descargados...' });
        await guardarCapitulosTraidos(saved.id, traidos);
        sendProgress({ step: 'complete', message: `¡Importado! ${capitulosGuardados(traidos.length)}.` });
      } else {

        if (saved.chapterList && saved.chapterList.length > 0) {
          await cola.encolar('descargar-capitulos', { fanficId: String(saved.id) });
        }
        sendProgress({ step: 'complete', message: '¡Importado! Los capítulos se descargan en segundo plano.' });
      }

      bajarPortada(saved);

      return { status: 'success', data: saved };
    } catch (error) {
      console.error('[Backend] Error en scrape:', error);
      sendProgress({ step: 'error', message: `Error: ${error.message}` });
      return { status: 'error', message: error.message };
    }
  });

}

module.exports = { registrar, importarLibro, obraParaGuardar, camposFrescos };
