const { app, BrowserWindow, nativeTheme } = require('electron');

require('./consola-segura.js').protegerConsola();

app.setName('mylaiberry-libre');

nativeTheme.themeSource = 'dark';

const clienteRemoto = require('./cliente-remoto.js');
if (clienteRemoto.activo()) { clienteRemoto.arrancar(); return; }

const instanciaUnica = app.requestSingleInstanceLock();

let alLlegarSegundaInstancia = null;

const ventanaApp = require('./ventana.js');
const { createWindow, avisar, traerAlFrente, ventana } = ventanaApp;

if (!instanciaUnica) {
  app.quit();
} else {

  app.on('second-instance', (evento, argv) => {

    if (alLlegarSegundaInstancia) alLlegarSegundaInstancia(argv);

    if (!traerAlFrente() && app.isReady()) createWindow();
  });
}

const { initDB, getSettings, alHaberConflicto } = require('./db.js');
const { migrateUserData } = require('./migrate-userdata.js');
const cola = require('./cola.js');
const avisos = require('./avisos.js');
const enlaces = require('./enlaces.js');
const traduccion = require('./traduccion-anticipada.js');
const mantenimiento = require('./mantenimiento.js');
const { planificar, replanificarCadaHora, arrancarCola } = require('./planificador.js');
const siempre = require('./siempre-abierta.js');

const tareas = {
  descargas: require('./tareas/descargas.js'),
  descubrir: require('./tareas/descubrir.js'),
  capitulos: require('./tareas/capitulos.js'),
  fondos: require('./tareas/fondos.js'),
  generos: require('./tareas/generos.js'),
  sinopsis: require('./tareas/sinopsis.js'),
  audio: require('./tareas/audio.js')
};

const manejadoresIPC = [
  require('./ipc/biblioteca.js'),
  require('./ipc/lectura.js'),
  require('./ipc/memoria-lectura.js'),
  require('./ipc/recordar-lectura.js'),
  require('./ipc/traduccion.js'),
  require('./ipc/descargas.js'),
  require('./ipc/descubrimientos.js'),
  require('./ipc/ajustes.js'),
  require('./ipc/fuera.js'),
  require('./ipc/audio.js'),

  require('./ipc/asistente.js'),

  require('./ipc/retos.js'),

  require('./ipc/series.js')
];

function registrarTrabajos() {

  cola.registrar('descargar-capitulos',
    (carga) => tareas.descargas.descargarFanfic(carga, { alGuardarCapitulo }),
    { respiro: 2000 });

  cola.registrar('comprobar-autor', tareas.descubrir.comprobarAutor, { respiro: 5000 });
  cola.registrar('comprobar-busqueda', tareas.descubrir.comprobarBusqueda, { respiro: 5000 });
  cola.registrar('comprobar-capitulos', tareas.capitulos.comprobarCapitulos, { respiro: 5000 });

  cola.registrar('importar-marcadores', tareas.descubrir.importarMarcadores, { respiro: 8000 });
  cola.registrar('buscar-fondos', tareas.fondos.buscarFondosDeFandom, { respiro: 8000 });

  cola.registrar('clasificar-genero', tareas.generos.clasificarGenero, { respiro: 1500 });

  cola.registrar('traducir-sinopsis', tareas.sinopsis.traducirSinopsisDeObra, { respiro: 2000 });

  cola.registrar('audio-capitulo', tareas.audio.generarAudioCapitulo, { respiro: 1000 });
}

async function alGuardarCapitulo(fanficId, indice, ajustes) {
  if (ajustes?.autoTranslate === false || !ajustes?.lang) return;
  if (indice < 3) traduccion.encolar(fanficId, [indice], ajustes.lang);
  traduccion.alLlegarCapitulo(fanficId, indice, ajustes.lang);
}

app.whenReady().then(async () => {

  if (!instanciaUnica) return;

  alLlegarSegundaInstancia = enlaces.registrar((url) => {
    traerAlFrente();
    avisar('importar-enlace', { url });
  });

  avisos.alTocarAviso((idObra) => {
    if (traerAlFrente()) {
      if (idObra) avisar('abrir-obra', { fanficId: idObra });
      return;
    }
    avisos.quitarDeBandeja();
    createWindow();
    if (idObra) {
      ventana()?.webContents.once('did-finish-load', () => {
        avisar('abrir-obra', { fanficId: idObra });
      });
    }
  });

  ventanaApp.aplicarPoliticaDeContenido();
  ventanaApp.registrarProtocoloLocal();

  console.log(`[Migración] ${migrateUserData().reason}`);
  await initDB();

  require('./aviso-push.js').actual();

  registrarTrabajos();

  require('./ipc-registro.js').instalar(require('electron').ipcMain);
  for (const grupo of manejadoresIPC) grupo.registrar();

  if (siempre.arrancaEnBandeja()) ponerEnBandeja();
  else createWindow();

  getSettings().then((ajustes) => siempre.alArrancar(ajustes, getSettings)).catch(() => {});

  alHaberConflicto((equipo) => avisar('sync-conflict', { equipo }));

  await mantenimiento.alArrancar();
  const deFondo = {
    completarFandomsQueFaltan: tareas.fondos.completarFandomsQueFaltan,
    encolarFondosPendientes: tareas.fondos.encolarFondosPendientes,
    encolarSinopsisPendientes: tareas.sinopsis.encolarSinopsisPendientes
  };
  await planificar(deFondo);
  await arrancarCola();

  replanificarCadaHora(deFondo);

  require('./ipc/asistente.js').arrancarLatido();

  require('./propuestas.js').arrancarVencimiento();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let saliendoDeVerdad = false;

function pararServidorLan() {

  require('./ipc/fuera.js').apagarLan().catch(() => {  });
}

let retiradoAlSalir = false;
app.on('before-quit', (evento) => {
  saliendoDeVerdad = true;
  if (!retiradoAlSalir) {
    evento.preventDefault();
    retiradoAlSalir = true;
    require('./ipc/fuera.js').apagarLan().catch(() => {}).finally(() => app.quit());
    return;
  }

  avisos.soltarLoPendiente();
  avisos.quitarDeBandeja();
});

app.on('window-all-closed', () => {
  if (saliendoDeVerdad) { pararServidorLan(); app.quit(); return; }

  getSettings().then((ajustes) => {

    if (!ajustes?.seguirEnSegundoPlano && !siempre.movilSiempre(ajustes)) {
      pararServidorLan();
      if (process.platform !== 'darwin') app.quit();
      return;
    }

    avisos.soltarLoPendiente();
    ponerEnBandeja();
  }).catch(() => {
    pararServidorLan();
    if (process.platform !== 'darwin') app.quit();
  });
});

function ponerEnBandeja() {
  avisos.ponerEnBandeja({
    alAbrir: () => { avisos.quitarDeBandeja(); createWindow(); },
    alSalir: () => { saliendoDeVerdad = true; app.quit(); }
  });
}
