const CLAVE_AUDIO = (obra, indice, idioma) => [String(obra), Number(indice), String(idioma || 'original')];

function huellaDeTexto(texto) {
  return String(texto || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 60);
}

function comprobarIntegridadAudio(meta, blob) {
  return Boolean(meta && meta.estado === 'completo' && blob && typeof blob.size === 'number'
    && blob.size > 0 && blob.size === meta.tamano);
}

async function guardarAudioViaje(meta, blob) {
  if (!meta || !meta.obra || blob == null) throw new Error('Datos de audio no válidos');
  const bd = await abrirViaje();
  const clave = CLAVE_AUDIO(meta.obra, meta.indice, meta.idioma);
  return new Promise((ok, mal) => {
    const tx = bd.transaction(['audios', 'audioDatos'], 'readwrite');
    const storeDatos = tx.objectStore('audioDatos');
    const storeMeta = tx.objectStore('audios');

    storeDatos.put({ obra: clave[0], indice: clave[1], idioma: clave[2], blob });
    storeMeta.put({
      ...meta,
      obra: clave[0],
      indice: clave[1],
      idioma: clave[2],
      tamano: blob.size,
      formato: meta.formato || 'mp3',
      estado: 'completo',
      guardadoEn: Date.now(),
      fijadoParaViaje: true
    });
    tx.oncomplete = () => { bd.close(); ok(true); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Escritura de audio interrumpida.')); };
  });
}

async function leerAudioViaje(obra, indice, idioma) {
  const bd = await abrirViaje();
  const clave = CLAVE_AUDIO(obra, indice, idioma);
  return new Promise((ok, mal) => {
    const tx = bd.transaction(['audios', 'audioDatos'], 'readonly');
    const reqMeta = tx.objectStore('audios').get(clave);
    const reqDatos = tx.objectStore('audioDatos').get(clave);
    let meta = null, datos = null;
    reqMeta.onsuccess = () => { meta = reqMeta.result || null; };
    reqDatos.onsuccess = () => { datos = reqDatos.result || null; };
    tx.oncomplete = () => {
      bd.close();
      if (meta && datos && comprobarIntegridadAudio(meta, datos.blob)) {
        ok({ meta, blob: datos.blob });
      } else {
        ok(null);
      }
    };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); ok(null); };
  });
}

async function listarAudiosDeObra(obra) {
  const bd = await abrirViaje();
  return new Promise((ok, mal) => {
    const tx = bd.transaction('audios', 'readonly');
    const rango = IDBKeyRange.bound([String(obra)], [String(obra), []]);
    const req = tx.objectStore('audios').getAll(rango);
    req.onsuccess = () => { bd.close(); ok(req.result || []); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); ok([]); };
  });
}

async function borrarAudiosDeObra(obra) {
  const bd = await abrirViaje();
  const rango = IDBKeyRange.bound([String(obra)], [String(obra), []]);
  return new Promise((ok, mal) => {
    const tx = bd.transaction(['audios', 'audioDatos'], 'readwrite');
    tx.objectStore('audios').delete(rango);
    tx.objectStore('audioDatos').delete(rango);
    tx.oncomplete = () => { bd.close(); ok(); };
    tx.onerror = () => { bd.close(); mal(tx.error); };
    tx.onabort = () => { bd.close(); mal(tx.error || new Error('Borrado de audio interrumpido.')); };
  });
}

async function fijadoDeAudio(id, indice, opt) {
  const idi = opt?.idioma || 'original';
  const a = await leerAudioViaje(id, indice, idi).catch(() => null);
  return a ? { valor: { estado: 'listo', ...a.meta, local: true, fijado: true } } : null;
}

async function bajarAudioParaViaje(estado, indice) {
  try {
    const idi = estado.idioma || 'original';
    if (!estado.revisionPendiente && await leerAudioViaje(estado.id, indice, idi)) return;
    const { cuerpo } = await llamarAlPC('audio-capitulo', [estado.id, indice, { idioma: idi, pedir: false }]);
    const info = cuerpo?.valor;
    if (info?.estado === 'listo' && info.uri) {
      const r = await fetch(info.uri);
      const blob = r.ok ? await r.blob() : null;
      if (blob && blob.size > 0) {
        await guardarAudioViaje({
          obra: estado.id,
          indice,
          idioma: idi,
          marcas: info.marcas || [],
          frases: info.frases || null,
          huellaTexto: info.huellaTexto || null
        }, blob);
      }
    }
  } catch {  }
}

