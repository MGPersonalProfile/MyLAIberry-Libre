const MINUTOS_ENTRE_LATIDOS = 15;

const SEGUNDOS_HASTA_EL_PRIMERO = 60;

function crearLatido({
  tick,
  intervalo = MINUTOS_ENTRE_LATIDOS * 60000,
  retraso = SEGUNDOS_HASTA_EL_PRIMERO * 1000,
  temporizador = { poner: setTimeout, quitar: clearTimeout },
  registrar = (mensaje) => console.warn('[Asistente]', mensaje)
} = {}) {
  if (typeof tick !== 'function') throw new Error('El latido necesita un tick.');

  let pendiente = null;
  let vivo = false;
  let latiendo = false;
  let latidos = 0;
  let fallos = 0;

  function programar(espera) {
    if (!vivo) return;
    pendiente = temporizador.poner(() => { pendiente = null; latir(); }, espera);

    pendiente?.unref?.();
  }

  async function latir() {
    if (!vivo || latiendo) return { saltado: true };
    latiendo = true;
    try {
      await tick();
      latidos++;
      return { ok: true };
    } catch (error) {
      fallos++;
      registrar('el latido falló: ' + error.message);
      return { ok: false, error: error.message };
    } finally {
      latiendo = false;
      programar(intervalo);
    }
  }

  return {
    arrancar() {
      if (vivo) return false;
      vivo = true;
      programar(retraso);
      return true;
    },
    parar() {
      vivo = false;
      if (pendiente) temporizador.quitar(pendiente);
      pendiente = null;
    },
    latir,
    get estado() { return { vivo, latiendo, latidos, fallos, programado: pendiente !== null }; }
  };
}

module.exports = { crearLatido, MINUTOS_ENTRE_LATIDOS, SEGUNDOS_HASTA_EL_PRIMERO };
