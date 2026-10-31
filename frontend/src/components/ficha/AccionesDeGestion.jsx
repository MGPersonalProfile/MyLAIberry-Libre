import { Trash2, RefreshCw, Image as ImageIcon, Bell, Bookmark, FileDown, Plus, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';

function useAcciones(p) {
  const { t } = useI18n();
  const { obra, descarga, exportando, autoresSeguidos } = p;
  const siguiendo = autoresSeguidos.some(a => a.url === obra.autorUrl);
  const bloqueada = descarga.enCurso || obra.needsChapterSelection;
  return [
    { id: 'refrescar', icono: RefreshCw, girando: descarga.enCurso, texto: t('detail.refresh'), titulo: t('detail.refresh_title'),
      al: () => p.alRefrescar(obra), desactivada: bloqueada },
    { id: 'lista', icono: Bookmark, activa: obra.enMiLista, texto: obra.enMiLista ? t('mylist.added') : t('mylist.add'),
      al: () => p.alAlternarMiLista(obra) },
    { id: 'seguir', icono: Bell, activa: siguiendo, texto: siguiendo ? t('detail.following') : t('detail.follow'),
      titulo: t('detail.follow_title'), al: () => p.alSeguirAutor(obra) },
    obra.coverUrl && { id: 'portada', icono: ImageIcon, titulo: t('detail.cover_title'),
      texto: obra.portadaPreferida === 'generada' ? t('detail.cover_use_author') : t('detail.cover_use_generated'),
      al: () => p.alCambiarPortada(obra) },
    (obra.downloadedChapters || 0) > 0 && window.api?.exportarEpub && { id: 'epub', icono: FileDown,
      texto: exportando ? t('detail.epub_working') : t('detail.epub'), titulo: t('detail.epub_title'),
      al: () => p.alExportar(obra), desactivada: exportando },
    obra.origen === 'descubierta' && { id: 'guardar', icono: Plus, texto: t('discover.save'), al: () => p.alGuardar(obra) },
    obra.origen === 'descubierta' && { id: 'descartar', icono: X, texto: t('detail.discard'), titulo: t('detail.discard_title'),
      al: () => p.alDescartar(obra) }
  ].filter(Boolean);
}

export default function AccionesDeGestion(p) {
  const acciones = useAcciones(p);
  if (p.movil) {
    return (
      <div className="grid grid-cols-4 gap-y-3 mb-6">
        {acciones.map(a => <AccionMovil key={a.id} {...a} />)}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {acciones.map(a => <AccionEscritorio key={a.id} {...a} />)}
      <Borrar {...p} />
    </div>
  );
}

function AccionMovil({ icono: Icono, texto, al, activa, girando, desactivada }) {
  return (
    <button
      type="button"
      onClick={al}
      disabled={desactivada}
      className={`min-h-16 px-1 flex flex-col items-center justify-start gap-1.5 active:opacity-60 disabled:opacity-40 ${activa ? 'text-red-500' : 'text-gray-200'}`}
    >
      <Icono className={`w-6 h-6 ${activa ? 'fill-current' : ''} ${girando ? 'animate-spin' : ''}`} />
      <span className="text-[11px] leading-tight text-center line-clamp-2">{texto}</span>
    </button>
  );
}

function AccionEscritorio({ icono: Icono, texto, titulo, al, activa, girando, desactivada }) {
  return (
    <button
      type="button"
      onClick={al}
      disabled={desactivada}
      title={titulo}
      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${
        activa ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-gray-700 text-gray-300 hover:border-gray-400 hover:text-white'
      }`}
    >
      <Icono className={`w-4 h-4 shrink-0 ${activa && Icono === Bookmark ? 'fill-current' : ''} ${girando ? 'animate-spin' : ''}`} />
      {texto}
    </button>
  );
}

export function Borrar({ obra, movil, confirmandoBorrado, alBorrar, alPedirBorrado, alCancelarBorrado }) {
  const { t } = useI18n();
  if (confirmandoBorrado) {
    return (
      <div className={`flex items-center gap-2 ${movil ? 'w-full' : 'ml-auto'}`}>
        <span className={`text-sm text-gray-400 whitespace-nowrap ${movil ? 'flex-1' : ''}`}>{t('detail.delete_sure')}</span>
        <button type="button" onClick={() => alBorrar(obra.id)} className={`${movil ? 'h-11 px-4' : 'px-3 py-2'} rounded-lg text-sm font-bold whitespace-nowrap bg-red-600 text-white hover:bg-red-700 transition-colors`}>
          {t('common.confirm')}
        </button>
        <button type="button" onClick={alCancelarBorrado} className={`${movil ? 'h-11 px-4' : 'px-3 py-2'} rounded-lg text-sm font-medium whitespace-nowrap bg-gray-700 text-white hover:bg-gray-600 transition-colors`}>
          {t('common.cancel')}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => alPedirBorrado(obra.id)}
      className={`${movil ? 'w-full h-11 justify-center' : 'ml-auto px-3 py-2'} rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap text-red-400 border border-red-500/20 hover:bg-red-500/10 active:bg-red-500/10 hover:border-red-500/40 transition-colors`}
    >
      <Trash2 className="w-4 h-4 shrink-0" /> {t('common.delete')}
    </button>
  );
}
