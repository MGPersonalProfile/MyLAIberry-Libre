const BD_VIAJE = 'mylaiberry-viaje-1';
let viajeEnCurso = null;

const viajeCancelado = new Set();

function abrirViaje() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD_VIAJE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('obras', { keyPath: 'id' });
      r.result.createObjectStore('capitulos', { keyPath: ['obra', 'indice'] });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function leerViaje(almacen, clave) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, 'readonly');
    const r = tx.objectStore(almacen).get(clave);
    r.onsuccess = () => ok(r.result || null);
    r.onerror = () => mal(r.error);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Lectura local interrumpida.')); };
  });
}

async function escribirViaje(almacen, valor) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(almacen, 'readwrite');
    tx.objectStore(almacen).put(valor);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Guardado local interrumpido.')); };
  });
}

async function obrasDeViaje() {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('obras', 'readonly');
    const r = tx.objectStore('obras').getAll();
    r.onsuccess = () => ok(r.result || []);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
  });
}

async function borrarViaje(id) {
  const estado = await leerViaje('obras', id);
  if (!estado) return;
  const bd = await abrirViaje();
  await new Promise((ok, mal) => {
    const tx = bd.transaction(['obras', 'capitulos'], 'readwrite');
    tx.objectStore('obras').delete(id);
    for (let i = 0; i < (estado.almacenados || estado.total); i++) tx.objectStore('capitulos').delete([id, i]);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Borrado local interrumpido.')); };
  });
}

async function avisarViaje(id, estado) {
  for (const c of await self.clients.matchAll()) c.postMessage({ tipo: 'viaje-estado', id, estado });
}

async function prepararViaje(id, total, forzar) {
  const anterior = await leerViaje('obras', id);
  const reintentarHuecos = !!anterior?.faltantes?.length && !anterior.continuar;
  const desde = forzar || reintentarHuecos ? 0
    : anterior?.total === total ? anterior.guardados || 0
      : anterior?.completa && anterior.total < total ? anterior.total : 0;
  const estado = { id, total, guardados: desde, completa: false, continuar: true,
    revisionPendiente: forzar || !!anterior?.revisionPendiente,
    faltantes: forzar || reintentarHuecos ? [] : anterior?.faltantes || [],
    almacenados: Math.max(total, anterior?.almacenados || anterior?.total || 0) };
  await escribirViaje('obras', estado);
  return estado;
}

async function traerCapituloViaje(id, indice) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const { estado, cuerpo } = await llamarAlPC('get-chapter-content', [id, indice]);
      if (estado === 200) {
        const html = cuerpo?.valor;
        return typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim() ? html : null;
      }
    } catch {  }
    if (intento < 2) await new Promise(ok => setTimeout(ok, 300 * (intento + 1)));
  }
  throw new Error(`No se pudo traer el capítulo ${indice + 1} del PC. Se reanudará al reconectar.`);
}

async function descargarTramoViaje(estado) {
  const fin = Math.min(estado.total, estado.guardados + 12);
  for (let i = estado.guardados; i < fin; i++) {
    if (viajeCancelado.has(estado.id)) break;
    if (estado.revisionPendiente || !await leerViaje('capitulos', [estado.id, i])) {
      const html = await traerCapituloViaje(estado.id, i);
      if (html) {
        await escribirViaje('capitulos', { obra: estado.id, indice: i, html });
        await (await caches.open(CACHE)).delete(claveDe('get-chapter-content', [estado.id, i]));
      } else estado.faltantes.push(i);
    }
    estado.guardados = i + 1;
    await escribirViaje('obras', { ...estado });
    if (i % 5 === 4) await avisarViaje(estado.id, { ...estado, enCurso: true });
  }
  estado.continuar = estado.guardados < estado.total;
  if (!estado.continuar && estado.faltantes.length) {
    const numeros = estado.faltantes.slice(0, 3).map(i => i + 1).join(', ');
    estado.error = estado.faltantes.length === 1
      ? `Falta el capítulo ${numeros} en el PC; descárgalo allí y reintenta.`
      : `Faltan capítulos ${numeros} en el PC; descárgalos allí y reintenta.`;
  } else if (!estado.continuar) {
    estado.completa = true;
    estado.revisionPendiente = false;
  }
  await escribirViaje('obras', { ...estado });
  return estado;
}

async function descargarViaje(id, total, forzar = false) {
  if (viajeEnCurso) {

    if (viajeEnCurso !== id) await prepararViaje(id, total, forzar).catch(() => {});
    const guardado = await leerViaje('obras', id).catch(() => null);
    return avisarViaje(id, guardado && { ...guardado, enCurso: viajeEnCurso === id,
      esperandoOtraObra: viajeEnCurso !== id });
  }
  viajeEnCurso = id;
  let salida;
  try { salida = await descargarTramoViaje(await prepararViaje(id, total, forzar)); }
  catch (e) {
    const estado = await leerViaje('obras', id).catch(() => null);
    const cuota = e.name === 'QuotaExceededError';
    const error = cuota ? 'No queda espacio para guardar esta obra en el móvil.'
      : e.message || 'No se pudo guardar la obra. Reintenta al reconectar.';
    salida = { id, total, guardados: 0, ...estado, continuar: false, enCurso: false, error,
      reintentarAlConectar: !cuota };
    await escribirViaje('obras', salida).catch(() => {});
  } finally { viajeEnCurso = null; }
  if (viajeCancelado.delete(id)) {
    await borrarViaje(id).catch(() => {});
    return avisarViaje(id, null);
  }

  return avisarViaje(id, { ...salida, enCurso: false, terminada: !!salida.completa });
}

const pendienteDeViaje = (o, conectado) => !!o && !o.completa
  && ((o.continuar ?? (o.guardados || 0) < o.total) && !o.error || conectado && !!o.reintentarAlConectar);

async function reanudarViaje(conectado) {
  if (viajeEnCurso) return;
  const pendiente = (await obrasDeViaje()).find(o => pendienteDeViaje(o, conectado));
  if (pendiente) return descargarViaje(pendiente.id, pendiente.total);
}

async function mensajeViaje(d) {
  if (d.tipo === 'viaje-reanudar') return reanudarViaje(d.conectado === true);
  const id = d.id;
  if (typeof id !== 'string' || !/^[\w.-]{1,160}$/.test(id)) return;
  if (d.tipo === 'viaje-estado') {
    const estado = await leerViaje('obras', id);
    return avisarViaje(id, estado && { ...estado, enCurso: viajeEnCurso === id });
  }

  if (d.tipo === 'viaje-seguir') {
    const estado = await leerViaje('obras', id).catch(() => null);
    return pendienteDeViaje(estado, true) ? descargarViaje(id, estado.total) : undefined;
  }
  if (d.tipo === 'viaje-borrar') {
    if (viajeEnCurso === id) {
      viajeCancelado.add(id);
      const estado = await leerViaje('obras', id).catch(() => null);
      return avisarViaje(id, { ...estado, enCurso: true, cancelando: true });
    }
    try {
      await borrarViaje(id);
      return avisarViaje(id, null);
    } catch {
      const estado = await leerViaje('obras', id).catch(() => null);
      return avisarViaje(id, { ...estado, error: 'No se pudo borrar la copia del móvil.' });
    }
  }
  if (['viaje-guardar', 'viaje-refrescar'].includes(d.tipo)
    && Number.isInteger(d.total) && d.total > 0 && d.total <= 20000)
    return descargarViaje(id, d.total, d.tipo === 'viaje-refrescar');
}
