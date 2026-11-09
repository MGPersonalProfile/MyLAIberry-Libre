const CANALES_DECISION_PROPUESTA = new Set(['adopt-work', 'discard-work', 'undo-discard']);
let enviandoDecisiones = null;

const esDecisionPropuesta = canal => CANALES_DECISION_PROPUESTA.has(canal);

async function atenderDecisionPropuesta(peticion, canal, trabajos) {
  let args = [];
  try { args = await peticion.clone().json(); } catch {  }
  if (!pcNoContesta()) {
    try {
      const techo = typeof LARGAS !== 'undefined' && LARGAS.has(canal) ? TECHO_LARGO : (typeof TECHO_ACCION !== 'undefined' ? TECHO_ACCION : 180000);
      const r = await conPlazo(vigilar(fetch(peticion)), techo);
      if (r.ok) {
        const cuerpo = await r.clone().json().catch(() => null);
        if (cuerpo && !cuerpo.error) {
          await quitarDecisionBase(args[0]).catch(() => {});
          return r;
        }
      }
    } catch {  }
  }
  await encolarDecisionOffline(canal, args);
  trabajos.push(sincronizarDecisiones().catch(() => {}));
  return json({ valor: { status: 'ok', encolada: true } });
}

async function guardarPropuestasOffline(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('propuestas', 'readwrite');
    const store = tx.objectStore('propuestas');
    for (const item of lista) {
      if (item && item.id) store.put({ ...item, id: String(item.id) });
    }
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Error al guardar propuestas offline.')); };
  });
}

async function leerPropuestasBase() {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('propuestas', 'readonly');
    const r = tx.objectStore('propuestas').getAll();
    r.onsuccess = () => ok(r.result || []);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
  });
}

async function leerDecisionesBase() {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('decisiones_propuestas', 'readonly');
    const r = tx.objectStore('decisiones_propuestas').getAll();
    r.onsuccess = () => ok(r.result || []);
    tx.oncomplete = () => bd.close();
    tx.onerror = () => { bd.close(); mal(tx.error || r.error); };
  });
}

async function quitarDecisionBase(id) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('decisiones_propuestas', 'readwrite');
    tx.objectStore('decisiones_propuestas').delete(String(id));
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Error al quitar decisión offline.')); };
  });
}

async function encolarDecisionOffline(canal, args) {
  const id = String(args?.[0] || '');
  if (!id) return;
  const accion = canal === 'adopt-work' ? 'guardar' : (canal === 'undo-discard' ? 'deshacer' : 'descartar');
  const opciones = canal === 'adopt-work' ? (args[1] || {}) : undefined;
  const registro = { id, accion, ...(opciones ? { opciones } : {}), en: Date.now() };

  const bd = await abrirViaje();
  await new Promise((ok, mal) => {
    const tx = bd.transaction(['decisiones_propuestas', 'propuestas'], 'readwrite');
    tx.objectStore('decisiones_propuestas').put(registro);

    const storeProp = tx.objectStore('propuestas');
    const pet = storeProp.get(id);
    pet.onsuccess = () => {
      const p = pet.result;
      if (p) {
        if (accion === 'descartar') {
          p.origen = 'descartada';
          p.descartadaEn = Date.now();
        } else if (accion === 'guardar') {
          p.origen = 'propia';
        } else if (accion === 'deshacer') {
          p.origen = 'descubierta';
          delete p.descartadaEn;
        }
        storeProp.put(p);
      }
    };

    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Error al encolar decisión.')); };
  });
}

async function conPropuestasGuardadas(canal, args, cuerpo) {
  if (canal !== 'get-discoveries' && canal !== 'get-discarded-works') return false;
  const [propuestas, decisiones] = await Promise.all([leerPropuestasBase().catch(() => []), leerDecisionesBase().catch(() => [])]);
  if (!propuestas.length && !decisiones.length) return false;

  const mapaDecisiones = new Map(decisiones.map(d => [String(d.id), d]));
  const proyectadas = propuestas.map(p => {
    const copia = { ...p };
    const dec = mapaDecisiones.get(String(p.id));
    if (dec) {
      if (dec.accion === 'descartar') {
        copia.origen = 'descartada';
        copia.descartadaEn = dec.en || Date.now();
      } else if (dec.accion === 'guardar') {
        copia.origen = 'propia';
      } else if (dec.accion === 'deshacer') {
        copia.origen = 'descubierta';
        delete copia.descartadaEn;
      }
    }
    return copia;
  });

  if (canal === 'get-discoveries') {
    cuerpo.valor = proyectadas.filter(p => p.origen === 'descubierta');
    return true;
  }
  if (canal === 'get-discarded-works') {
    cuerpo.valor = proyectadas.filter(p => p.origen === 'descartada');
    return true;
  }
  return false;
}

async function ejecutarDecisionPC(d) {
  if (d.accion === 'guardar') return llamarAlPC('adopt-work', [d.id, d.opciones || {}]);
  if (d.accion === 'deshacer') return llamarAlPC('undo-discard', [d.id]);
  return llamarAlPC('discard-work', [d.id]);
}

async function sincronizarDecisionesAhora(forzar) {
  if (!forzar && pcNoContesta()) return;
  const decisiones = await leerDecisionesBase().catch(() => []);
  if (!decisiones.length) return;

  let sincronizadas = 0;
  for (const d of decisiones) {
    let r;
    try { r = await vigilar(ejecutarDecisionPC(d)); } catch { return; }

    const ok = r?.estado === 200 || r?.cuerpo?.valor?.status === 'ok' || r?.cuerpo?.valor?.yaAdoptadaAlVencer;
    if (ok) {
      await quitarDecisionBase(d.id);
      sincronizadas++;
    } else if (r?.estado >= 400 && r?.estado < 500) {

      await quitarDecisionBase(d.id);
      sincronizadas++;
    }
  }
  if (sincronizadas > 0) {
    await avisarDeLoFresco('get-discoveries');
  }
}

function sincronizarDecisiones(forzar = false) {
  enviandoDecisiones ||= (async () => {
    try { await sincronizarDecisionesAhora(forzar); }
    finally { enviandoDecisiones = null; }
  })();
  return enviandoDecisiones;
}
