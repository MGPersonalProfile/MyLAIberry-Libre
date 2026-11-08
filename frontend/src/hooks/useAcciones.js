import { useState } from 'react';
import { avisar, motivo, exigir } from '../avisos';

export function useAcciones({ refrescar, interfaz, t }) {
  const { fetchLibrary, fetchDiscoveries, fetchAutores } = refrescar;
  const {
    autoresSeguidos, setLibrary, setDownloads, setShowDetail,
    setSelectedStory, setIsReading, setConfirmDelete
  } = interfaz;

  const [avisoAutor, setAvisoAutor] = useState(null);

  const [exportando, setExportando] = useState(null);
  const [avisoEpub, setAvisoEpub] = useState(null);

  const adoptar = async (story, opciones) => {
    try {
      const r = await window.api?.adoptWork?.(story.id, opciones);
      if (r?.status === 'error') throw new Error(r.message);
      return r;
    } catch (err) {
      avisar(t('aviso.fallo', { motivo: motivo(err) }), 'error');
      throw err;
    }
  };

  const abrirDescubrimiento = async (story) => {

    await adoptar(story, {}).catch(() => {});
    setSelectedStory(story);
    setIsReading(true);
    fetchLibrary();
    fetchDiscoveries();
  };

  const alternarSeguirAutor = async (story) => {
    const yaSeguido = autoresSeguidos.some(a => a.url === story.autorUrl);
    if (yaSeguido) {
      exigir(await window.api?.unfollowAuthor?.(story.autorUrl));
    } else {
      const r = await window.api?.followAuthor?.(story.id);
      if (r?.status === 'error') { setAvisoAutor(r.message); return; }
    }
    setAvisoAutor(null);
    fetchAutores();
  };

  const dejarDeSeguirAutor = async (url) => {
    exigir(await window.api?.unfollowAuthor?.(url));
    fetchAutores();
  };

  const alternarMiLista = async (fanfic) => {
    const dentro = !fanfic.enMiLista;

    if (dentro && fanfic.origen === 'descubierta') {
      try { await adoptar(fanfic, { paraLeer: false }); } catch { return; }
      fetchDiscoveries();
    }
    exigir(await window.api?.setInMyList?.(fanfic.id, dentro));
    setShowDetail(prev => (prev && prev.id === fanfic.id
      ? { ...prev, enMiLista: dentro ? Date.now() : null, origen: dentro && prev.origen === 'descubierta' ? 'propia' : prev.origen }
      : prev));
    fetchLibrary();
  };

  const decidirGenero = async (fanfic, nombre, aceptar) => {
    exigir(await window.api?.decidirGenero?.(fanfic.id, nombre, aceptar));
    const frescas = await window.api?.getLibrary?.();
    const actualizada = (frescas || []).find(o => o.id === fanfic.id);
    if (actualizada) setShowDetail(actualizada);
    setLibrary(frescas || []);
  };

  const guardarDescubrimiento = async (story) => {
    let hecho = false;
    try {
      await adoptar(story, { paraLeer: false });
      avisar(t('aviso.guardada', { titulo: story.title }));
      hecho = true;
    } catch {  }
    fetchLibrary();
    fetchDiscoveries();

    return hecho;
  };

  const descartarDescubrimiento = async (story) => {
    try {
      const r = await window.api?.discardWork?.(story.id);
      if (r?.status === 'error') throw new Error(r.message);
      avisar(
        t('aviso.descartada', { titulo: story.title }),
        'ok',
        {
          etiqueta: t('common.undo'),
          alPulsar: async () => {
            const res = await window.api?.deshacerDescarte?.(story.id);
            if (res?.status === 'ok') {
              avisar(t('aviso.descarte_deshecho', { titulo: story.title }));
              fetchDiscoveries();
            }
          }
        },
        10000
      );
      setShowDetail(null);
    } catch (err) {
      avisar(t('aviso.fallo', { motivo: motivo(err) }), 'error');
    }
    fetchDiscoveries();
  };

  const handlePortada = async (fanfic) => {
    const nueva = fanfic.portadaPreferida === 'generada' ? 'autor' : 'generada';
    exigir(await window.api?.setCoverPreference?.(fanfic.id, nueva));
    setShowDetail(prev => (prev && prev.id === fanfic.id ? { ...prev, portadaPreferida: nueva } : prev));
    fetchLibrary();
  };

  const exportarEpub = async (fanfic) => {
    setExportando(fanfic.id);
    setAvisoEpub(null);
    try {
      const r = await window.api?.exportarEpub?.(fanfic.id);
      if (r?.status === 'ok') {
        setAvisoEpub({
          texto: r.capitulos < r.total
            ? t('detail.epub_partial', { hechos: r.capitulos, total: r.total })
            : t('detail.epub_done', { hechos: r.capitulos }),
          ruta: r.ruta
        });
      } else if (r?.status !== 'cancelado') {
        setAvisoEpub({ texto: r?.message || t('detail.epub_failed'), error: true });
      }
    } catch (err) {
      setAvisoEpub({ texto: err?.message || t('detail.epub_failed'), error: true });
    } finally {
      setExportando(null);
    }
  };

  const handleRefresh = async (fanfic) => {
    if (!window.api) return;
    const id = String(fanfic.id);
    setDownloads(prev => ({
      ...prev,
      [id]: { ...prev[id], message: t('detail.refreshing'), active: true, error: null }
    }));
    let res;
    try { res = await window.api.refreshChapters(id); }
    catch (err) { res = { status: 'error', message: motivo(err) }; }

    if (res.status === 'ok') avisar(res.nuevos > 0 ? t('aviso.nuevos', { titulo: fanfic.title, n: res.nuevos }) : t('aviso.al_dia', { titulo: fanfic.title }));
    else avisar(t('aviso.fallo', { motivo: res.message || '' }), 'error');
    setDownloads(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        active: false,
        message: res.status === 'ok'
          ? (res.nuevos > 0 ? t('detail.refresh_new', { n: res.nuevos }) : t('detail.refresh_none'))
          : '',
        error: res.status === 'error' ? res.message : null
      }
    }));
    if (res.status === 'ok') {
      const fresh = await window.api.getLibrary();
      setLibrary(fresh);
      const actualizado = fresh.find(f => String(f.id) === id);
      if (actualizado) setShowDetail(actualizado);
    }
  };

  const handleDownload = async (fanfic) => {
    if (!window.api) return;
    const id = String(fanfic.id);
    setDownloads(prev => ({
      ...prev,
      [id]: {
        downloaded: fanfic.downloadedChapters || 0,
        total: fanfic.totalChapters || 0,
        message: t('detail.preparing'),
        active: true,
        error: null
      }
    }));
    const res = await window.api.resumeDownload(id);
    if (res.status === 'complete' || res.status === 'error') {
      setDownloads(prev => ({
        ...prev,
        [id]: { ...prev[id], active: false, message: res.message || '', error: res.status === 'error' ? res.message : null }
      }));
      fetchLibrary();
    }
  };

  const handleDelete = async (id) => {
    if (window.api) {
      await window.api.deleteFanfic(id);
      setConfirmDelete(null);
      setShowDetail(null);
      fetchLibrary();
    }
  };
  return {
    abrirDescubrimiento, guardarDescubrimiento, alternarSeguirAutor, dejarDeSeguirAutor,
    alternarMiLista, decidirGenero, descartarDescubrimiento,
    handlePortada, exportarEpub, handleRefresh, handleDownload, handleDelete,
    avisoAutor, exportando, avisoEpub
  };
}
