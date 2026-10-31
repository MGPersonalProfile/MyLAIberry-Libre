const { ipcMain } = require('electron');

const cola = require('../cola.js');
const {
  getFanficById, getAutores, seguirAutor, dejarDeSeguirAutor,
  getSuscripciones, anadirSuscripcion, quitarSuscripcion
} = require('../db.js');
const { admiteAutores, urlDeAutor } = require('../scrapers/index.js');
const { confirmarGenero, descartarGenero } = require('../db.js');
const { propagarGenero } = require('../tareas/generos.js');

function registrar() {

  ipcMain.handle('import-bookmarks', async (event, url) => {
    const limpia = String(url || '').trim();
    if (!/archiveofourown\.org\/users\//.test(limpia)) {
      return { status: 'error', message: 'Pega la dirección de tu perfil de AO3 (archiveofourown.org/users/…)' };
    }
    await cola.encolar('importar-marcadores', { url: limpia, pagina: 1 });
    return { status: 'ok' };
  });

  ipcMain.handle('get-subscriptions', async () => await getSuscripciones());

  ipcMain.handle('add-subscription', async (event, consulta, umbral) => {
    const texto = String(consulta || '').trim();
    if (!texto) return { status: 'error', message: 'Escribe qué quieres vigilar' };

    const esNueva = await anadirSuscripcion({ consulta: texto, fuente: 'AO3', umbral });
    if (!esNueva) return { status: 'ok', yaExistia: true };

    const sub = (await getSuscripciones()).find(s => s.consulta === texto);
    if (sub) await cola.encolar('comprobar-busqueda', { id: sub.id });

    return { status: 'ok' };
  });

  ipcMain.handle('remove-subscription', async (event, id) => {
    await quitarSuscripcion(id);
    return { status: 'ok' };
  });

  ipcMain.handle('get-followed-authors', async () => await getAutores());

  ipcMain.handle('follow-author', async (event, fanficId) => {
    const fanfic = await getFanficById(String(fanficId));
    if (!fanfic?.autorUrl) {

      return {
        status: 'error',
        message: 'Esta obra no guarda la dirección del autor. Pulsa "Buscar capítulos nuevos" y vuelve a intentarlo.'
      };
    }

    if (!admiteAutores(fanfic.autorUrl)) {
      return { status: 'error', message: `Todavía no se pueden seguir autores de ${fanfic.source}` };
    }

    const url = urlDeAutor(fanfic.autorUrl) || fanfic.autorUrl;

    const esNuevo = await seguirAutor({ url, nombre: fanfic.author, fuente: fanfic.source });

    if (esNuevo) await cola.encolar('comprobar-autor', { url });

    return { status: 'ok', yaSeguido: !esNuevo, url };
  });

  ipcMain.handle('unfollow-author', async (event, url) => {
    await dejarDeSeguirAutor(url);
    return { status: 'ok' };
  });

  ipcMain.handle('decidir-genero', async (event, fanficId, nombre, aceptar) => {
    const id = String(fanficId);
    if (!aceptar) {
      const ok = await descartarGenero(id, nombre);
      return { status: ok ? 'ok' : 'error' };
    }

    const ok = await confirmarGenero(id, nombre);

    const propagadas = ok ? await propagarGenero(id, nombre) : 0;
    return { status: ok ? 'ok' : 'error', propagadas };
  });

}

module.exports = { registrar };
