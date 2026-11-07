const SALTO_S = 10;

export function conectarMediaSession(lector, { titulo = '', artista = '', album = '', nav = globalThis.navigator, Metadata = globalThis.MediaMetadata } = {}) {
  const sesion = nav?.mediaSession;
  if (!sesion) return { actualizar() {}, desconectar() {} };
  try { if (Metadata) sesion.metadata = new Metadata({ title: titulo, artist: artista, album }); } catch {  }

  const hora = () => lector.audio?.currentTime ?? 0;
  const acciones = {
    play: () => lector.hablar(),
    pause: () => lector.parar(),
    stop: () => lector.parar(),
    seekto: (d) => { if (Number.isFinite(d?.seekTime)) lector.buscar(d.seekTime); },
    seekbackward: (d) => lector.buscar(hora() - (d?.seekOffset || SALTO_S)),
    seekforward: (d) => lector.buscar(hora() + (d?.seekOffset || SALTO_S)),
    previoustrack: () => lector.saltarFrase(-1),
    nexttrack: () => lector.saltarFrase(1)
  };
  for (const [nombre, fn] of Object.entries(acciones)) {
    try { sesion.setActionHandler(nombre, fn); } catch {  }
  }

  const actualizar = () => {
    sesion.playbackState = lector.leyendo ? 'playing' : 'paused';
    const duracion = lector.audio?.duration;
    if (Number.isFinite(duracion) && duracion > 0) {
      try {
        sesion.setPositionState({ duration: duracion, playbackRate: lector.velocidad || 1, position: Math.min(hora(), duracion) });
      } catch {  }
    } else if (sesion.setPositionState && lector.audio) {
      try { sesion.setPositionState({ duration: Math.max(hora(), 1), playbackRate: lector.velocidad || 1, position: hora() }); } catch {  }
    }
  };
  actualizar();

  const aviso = lector.alCambiar;
  lector.alCambiar = () => { aviso?.(); actualizar(); };

  const desconectar = () => {
    if (lector.alCambiar !== aviso) lector.alCambiar = aviso;
    for (const nombre of Object.keys(acciones)) {
      try { sesion.setActionHandler(nombre, null); } catch {  }
    }
    sesion.playbackState = 'none';
  };
  return { actualizar, desconectar };
}
