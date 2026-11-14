const REINTENTABLE = /UnknownVizError|VizSentEmptyBitmap|SurfaceUnavailable|^Captura vacía$/;

const colgadas = new WeakMap();
const ESPERAS_MS = [150, 350];
const PLAZO_MS = 5000;
const CADUCA_MS = 60000;

const espera = ms => new Promise(r => setTimeout(r, ms));

function conPlazo(promesa, ms) {
  let t;
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => { t = setTimeout(() => rechazar(new Error('capturePage sin respuesta en ' + ms + ' ms')), ms); }),
  ]).finally(() => clearTimeout(t));
}

async function capturarRecuperable(wc, { esperas = ESPERAS_MS, plazoMs = PLAZO_MS, caducaMs = CADUCA_MS, alReintentar } = {}) {
  const destruida = () => !wc || wc.isDestroyed?.() === true;
  for (let intento = 0; ; intento++) {
    if (destruida()) throw new Error('La ventana ya no existe.');
    const colgada = colgadas.get(wc);
    if (colgada && Date.now() - colgada.desde < caducaMs) throw new Error('La captura anterior de esta ventana sigue sin terminar.');
    if (colgada) colgadas.delete(wc);
    let error;
    let nativa = null;
    try {
      nativa = Promise.resolve(wc.capturePage());
      const imagen = await conPlazo(nativa, plazoMs);
      if (imagen && imagen.isEmpty?.() !== true) return imagen;
      error = new Error('Captura vacía');
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      if (nativa && /sin respuesta en/.test(error.message)) {
        const entrada = { nativa, desde: Date.now() };
        colgadas.set(wc, entrada);

        nativa.catch(() => {}).finally(() => { if (colgadas.get(wc) === entrada) colgadas.delete(wc); });
      }
    }
    const pasajero = REINTENTABLE.test(error.message) && !destruida();
    if (!pasajero || intento >= esperas.length) throw error;
    alReintentar?.(intento + 1, error);
    await espera(esperas[intento]);
  }
}

module.exports = { capturarRecuperable, ESPERAS_MS, PLAZO_MS, CADUCA_MS };
