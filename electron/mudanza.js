const ESPERA_MAXIMA_MS = 2 * 60 * 1000;
const CADA_MS = 250;

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

async function esperarA(listo, ms, cada = CADA_MS) {
  const hasta = Date.now() + ms;
  while (!listo()) {
    if (Date.now() > hasta) return false;
    await dormir(cada);
  }
  return true;
}

let mudando = false;

async function mudarBiblioteca(nuevaRuta, d) {
  if (mudando) return { ok: false, error: 'Ya se está mudando la biblioteca: espera a que termine.' };
  mudando = true;
  try {
    return await mudarConTodoParado(nuevaRuta, d);
  } finally {
    mudando = false;
  }
}

async function mudarConTodoParado(nuevaRuta, d) {
  const { setDataLocation, cola, traduccion, barrera } = d;
  const colaEstaba = cola.enMarcha();
  const espera = d.esperaMs ?? ESPERA_MAXIMA_MS;
  cola.parar();
  traduccion.detener();
  try {

    let quieto = await esperarA(() => !cola.enCurso() && !traduccion.ocupada(), espera);
    if (quieto) {
      barrera.cerrar();
      quieto = await esperarA(() => !barrera.ocupada(), espera);
    }
    if (!quieto) {
      return { ok: false, error: 'Hay una descarga o una traducción a medias. Espera a que termine y vuelve a intentarlo.' };
    }
    const res = await setDataLocation(nuevaRuta);

    if (res?.ok && !res.sinCambios && d.alMudar) {
      try { await d.alMudar(res.ruta); } catch (e) { return { ...res, avisoLan: e.message }; }
    }
    return res;
  } finally {
    barrera.abrir();
    traduccion.reanudar();
    if (colaEstaba) cola.arrancar();
  }
}

module.exports = { mudarBiblioteca, esperarA };
