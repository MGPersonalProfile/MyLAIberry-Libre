import { useState, useEffect } from 'react';
import { vistaGuardada } from '../vistaGuardada';
import { ultimaLectura } from '../lecturas';

function soltarAlCerrar(cancelar, sueltas) {
  if (typeof cancelar !== 'function') return;
  window.addEventListener('beforeunload', cancelar);
  sueltas?.push(() => { window.removeEventListener('beforeunload', cancelar); cancelar(); });
}

function escucharCambios({ fetchLibrary, fetchDiscoveries, setConflictoSync, alRecuperarVista }, sueltas) {

  window.api?.getSettings?.().then(s => {
    const vista = vistaGuardada(s);
    if (vista) alRecuperarVista?.(vista);
  }).catch(() => {  });

  window.api?.onSyncConflict?.(({ equipo }) => setConflictoSync(equipo));

  window.api?.onGenerosActualizados?.(() => fetchLibrary());

  window.api?.alActualizarCapitulos?.((d) => {
    fetchLibrary();
    if (d?.fundida) window.dispatchEvent(new CustomEvent('mylaiberry-obra-fundida', { detail: { id: d.fanficId } }));
  });

  soltarAlCerrar(window.api?.onDiscoveriesUpdated?.(() => fetchDiscoveries()), sueltas);

  soltarAlCerrar(window.api?.alCambiarEstadoLectura?.(() => fetchLibrary()), sueltas);
}

function escucharDescargas({ setDownloads, fetchLibrary }) {
  window.api.onDownloadProgress((data) => {
    const id = String(data.fanficId);

    setDownloads(prev => ({
      ...prev,
      [id]: {
        downloaded: data.downloaded ?? prev[id]?.downloaded ?? 0,
        total: data.total ?? prev[id]?.total ?? 0,
        message: data.message ?? prev[id]?.message ?? '',
        active: data.step !== 'complete' && data.step !== 'error',
        error: data.step === 'error' ? data.message : null
      }
    }));

    if (data.step === 'complete' || data.step === 'error') fetchLibrary();
    else if (data.step === 'chapter_saved' && data.downloaded % 5 === 0) fetchLibrary();
  });
}

function escucharLlegadas({ alLlegarEnlace, alPedirObra }, sueltas) {

  soltarAlCerrar(window.api.alLlegarEnlace?.(({ url }) => {
    if (url) alLlegarEnlace?.(url);
  }), sueltas);

  soltarAlCerrar(window.api.alPedirAbrirObra?.(async ({ fanficId, leer }) => {
    if (!fanficId) return;
    const todas = await window.api.getLibrary?.();
    const obra = (todas || []).find(f => String(f.id) === String(fanficId));

    if (obra) alPedirObra?.(obra, { leer: !!leer });
  }), sueltas);
}

export function useBiblioteca({ alLlegarEnlace, alPedirObra, alRecuperarVista } = {}) {
  const [library, setLibrary] = useState([]);

  const [cargada, setCargada] = useState(() => !window.api);

  const [discoveries, setDiscoveries] = useState([]);
  const [autoresSeguidos, setAutoresSeguidos] = useState([]);
  const [hero, setHero] = useState(null);
  const [conflictoSync, setConflictoSync] = useState(null);

  const [downloads, setDownloads] = useState({});

  const fetchLibrary = () => {
    if (window.api) {
      window.api.getLibrary().then(data => {
        if (data && data.length > 0) {
          setLibrary(data);
          setHero(ultimaLectura(data));
        } else {
          setLibrary([]);
          setHero(null);
        }
      }).catch(() => {  })
        .finally(() => setCargada(true));
    }
  };

  const fetchDiscoveries = () => {
    window.api?.getDiscoveries?.().then(d => setDiscoveries(d || [])).catch(() => {});
  };

  const fetchAutores = () => {
    window.api?.getFollowedAuthors?.().then(a => setAutoresSeguidos(a || [])).catch(() => {});
  };

  useEffect(() => {
    fetchLibrary();
    fetchDiscoveries();
    fetchAutores();

    const sueltas = [];
    escucharCambios({ fetchLibrary, fetchDiscoveries, setConflictoSync, alRecuperarVista }, sueltas);

    if (window.api) {
      escucharDescargas({ setDownloads, fetchLibrary });
      escucharLlegadas({ alLlegarEnlace, alPedirObra }, sueltas);
    }

    let caida = false;
    const alCambiarConexion = (e) => {
      if (!e.detail) { caida = true; return; }
      if (!caida) return;
      caida = false;
      fetchLibrary();
      fetchDiscoveries();
      fetchAutores();
    };

    const alLlegarLoFresco = (e) => {
      if (e.detail === 'get-library') fetchLibrary();
      if (e.detail === 'get-discoveries') fetchDiscoveries();
      if (e.detail === 'get-followed-authors') fetchAutores();
    };

    const alVolver = () => { if (document.visibilityState === 'visible') fetchLibrary(); };
    window.addEventListener('mylaiberry-conexion', alCambiarConexion);
    window.addEventListener('mylaiberry-fresco', alLlegarLoFresco);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.removeEventListener('mylaiberry-conexion', alCambiarConexion);
      window.removeEventListener('mylaiberry-fresco', alLlegarLoFresco);
      document.removeEventListener('visibilitychange', alVolver);
      for (const soltar of sueltas) soltar();
    };

  }, []);

  return {
    library, setLibrary, cargada,
    discoveries,
    autoresSeguidos,
    hero,
    downloads, setDownloads,
    conflictoSync, setConflictoSync,
    fetchLibrary, fetchDiscoveries, fetchAutores
  };
}
