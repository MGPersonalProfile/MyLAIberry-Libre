const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const TRABAJOS = {
  repetidos: ({ capitulos }) => require('./capitulos-repetidos.js').buscarRepetidos(capitulos),
  'repetidos-en-carpeta': ({ dir, n }) => require('./capitulos-repetidos.js').repetidosDeLaCarpeta(dir, n),
  'plan-de-reparacion': ({ dir, n }) => require('./reparar-obra.js').planDeReparacion(dir, n),
  buscar: ({ capitulos, buscado }) => require('./buscar-en-obra.js').buscarEnCapitulos(capitulos, buscado),
  'buscar-en-carpeta': ({ dir, buscado, n, idioma }) => require('./buscar-en-obra.js')
    .buscarEnLaCarpeta(dir, buscado, n, { rutaTraduccion: require('./translate.js').rutaTraduccion, idioma })
};

const TOPE_MS = 2 * 60 * 1000;

function enHilo(tipo, datos, { tope = TOPE_MS } = {}) {
  if (!TRABAJOS[tipo]) return Promise.reject(new Error(`Trabajo desconocido: ${tipo}`));
  return new Promise((resolve, reject) => {
    let arranco = false, hecho = false;
    const acabar = (fn, v) => { if (hecho) return; hecho = true; clearTimeout(reloj); fn(v); };
    let hilo;
    try { hilo = new Worker(__filename, { workerData: { tipo, datos } }); } catch { return aqui(); }
    const reloj = setTimeout(() => { hilo.terminate(); acabar(reject, new Error('El trabajo tardó más de dos minutos y se cortó.')); }, tope);
    hilo.once('online', () => { arranco = true; });
    hilo.once('message', (m) => { m.error ? acabar(reject, new Error(m.error)) : acabar(resolve, m.ok); hilo.terminate(); });

    const sinArrancar = () => { if (arranco || hecho) return false; clearTimeout(reloj); hecho = true; aqui(); return true; };
    hilo.once('error', (e) => { if (!sinArrancar()) acabar(reject, e); });
    hilo.once('exit', (codigo) => { if (!sinArrancar()) acabar(reject, new Error(`El hilo del trabajo salió sin responder (${codigo}).`)); });
    function aqui() {
      try { resolve(TRABAJOS[tipo](datos)); } catch (e) { reject(e); }
    }
  });
}

if (!isMainThread && workerData?.tipo) {
  try { parentPort.postMessage({ ok: TRABAJOS[workerData.tipo](workerData.datos) }); }
  catch (e) { parentPort.postMessage({ error: e.message }); }
}

module.exports = { enHilo, TRABAJOS };
