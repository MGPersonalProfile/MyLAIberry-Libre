let idiomaEnCurso = null;

async function programarIdiomaDeViaje(id, nuevoIdioma) {
  const estado = await leerViaje('obras', id).catch(() => null);
  if (!estado || !nuevoIdioma || typeof nuevoIdioma !== 'string') return;
  const cambio = estado.idioma !== nuevoIdioma;
  if (!cambio && !estado.traduccionPendiente) return;

  estado.idioma = nuevoIdioma;
  estado.traduccionPendiente = true;
  estado.traduccionCompleta = false;
  estado.traduccionesFaltantes = [];
  estado.reintentarAlConectar = false;
  await escribirViaje('obras', estado);

  if (!viajeEnCurso) {
    return completarIdiomaDeViaje(estado);
  }
}

async function descargarCapituloTraduccion(id, i, idioma) {
  const nombre = `la traducción del capítulo ${i + 1}`;
  let tiene = false;
  try {
    tiene = await preguntarAlPC('has-translation', [id, i, idioma], nombre);
  } catch {
    return { errorRed: true };
  }
  if (!tiene) return { faltante: true };

  let html = null;
  try {
    html = textoDe(await preguntarAlPC('translate-chapter', [id, i, idioma], nombre));
  } catch {
    return { errorRed: true };
  }
  if (html) {
    if (typeof comprobarContenidoViaje === 'function') {
      const chk = comprobarContenidoViaje('traduccion', html);
      if (!chk.permitido) return { errorCuota: chk.motivo };
    }
    await escribirViaje('traducciones', { obra: id, indice: i, idioma, html });
  }
  return { ok: true };
}

async function completarIdiomaDeViaje(estado) {
  if (!estado || !estado.id || !estado.idioma || idiomaEnCurso === estado.id) return estado;
  idiomaEnCurso = estado.id;
  const { id, idioma, total = 0 } = estado;
  const faltantes = [];

  try {
    for (let i = 0; i < total; i++) {
      if (viajeCancelado.has(id)) break;
      if (await leerViaje('traducciones', [id, i, idioma]).catch(() => null)) continue;
      if (typeof comprobarEspacioViaje === 'function') {
        const est = await (typeof navigator !== 'undefined' ? navigator.storage?.estimate?.() : null)?.catch?.(() => null);
        if (est && !comprobarEspacioViaje({ total: 1, guardados: 0 }, est).permitido) {
          estado.error = 'No queda espacio para guardar esta obra en el móvil.';
          estado.reintentarAlConectar = false;
          break;
        }
      }
      const res = await descargarCapituloTraduccion(id, i, idioma);
      if (res.errorRed) { estado.reintentarAlConectar = true; break; }
      if (res.errorCuota) { estado.error = res.errorCuota; break; }
      if (res.faltante) faltantes.push(i);
    }
    const actual = (await leerViaje('obras', id).catch(() => null)) || estado;
    if (actual.idioma === idioma) {
      actual.traduccionesFaltantes = faltantes;
      actual.traduccionPendiente = !!actual.reintentarAlConectar;
      actual.traduccionCompleta = !actual.reintentarAlConectar && faltantes.length === 0;
      await escribirViaje('obras', actual);
      await avisarViaje(id, actual);
      return actual;
    }
  } finally {
    if (idiomaEnCurso === id) idiomaEnCurso = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { programarIdiomaDeViaje, completarIdiomaDeViaje, descargarCapituloTraduccion };
}
