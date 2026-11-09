async function equipoQueSirve() {
  try {
    const puente = await (await caches.match(`${BASE}/puente.json`))?.json();
    if (puente?.equipo?.tipo) return puente.equipo;
  } catch {  }
  return { tipo: 'desconocido', nombre: 'equipo', name: 'host' };
}

async function enIdioma(es, en) {
  try { return (await ajustesGuardados())?.lang === 'en' ? en : es; } catch { return es; }
}

async function textoDelViaje(clave, dato) {
  const e = await equipoQueSirve();
  const en = await enIdioma(false, true);
  const x = en ? e.name : e.nombre;
  const alli = e.tipo === 'pc';
  const textos = {
    capitulo: en ? `Couldn't fetch chapter ${dato} from the ${x}. It will resume when you reconnect.`
      : `No se pudo traer el capítulo ${dato} del ${x}. Se reanudará al reconectar.`,
    traduccion: en ? `Couldn't fetch the translation of chapter ${dato} from the ${x}. It will resume when you reconnect.`
      : `No se pudo traer la traducción del capítulo ${dato} del ${x}. Se reanudará al reconectar.`,
    falta: en ? `Chapter ${dato} is missing on the ${x}; ${alli ? 'download it there' : 'download it from the work page'} and try again.`
      : `Falta el capítulo ${dato} en el ${x}; ${alli ? 'descárgalo allí' : 'descárgalo desde la ficha de la obra'} y reintenta.`,
    faltan: en ? `Chapters ${dato} are missing on the ${x}; ${alli ? 'download them there' : 'download them from the work page'} and try again.`
      : `Faltan capítulos ${dato} en el ${x}; ${alli ? 'descárgalos allí' : 'descárgalos desde la ficha de la obra'} y reintenta.`
  };
  return textos[clave];
}

