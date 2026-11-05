import { Trash2, RefreshCw, Image as ImageIcon, Bell, Bookmark, FileDown, Plus, X } from 'lucide-react';
import { SecondaryButton, DestructiveButton } from '../ui/Buttons';
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
      <div className="grid grid-cols-4 gap-2 mb-6">
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
      className={`min-h-14 py-2 px-1 rounded-md border border-border/60 bg-surface-secondary hover:bg-surface-hover flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-45 ${
        activa ? 'text-accent border-accent/40 bg-accent-soft' : 'text-text-primary'
      }`}
    >
      <Icono className={`w-5 h-5 ${activa ? 'fill-current' : ''} ${girando ? 'animate-spin' : ''}`} />
      <span className="text-[11px] leading-tight text-center text-text-secondary line-clamp-2 font-medium">{texto}</span>
    </button>
  );
}

function AccionEscritorio({ icono: Icono, texto, titulo, al, activa, girando, desactivada }) {
  return (
    <SecondaryButton
      onClick={al}
      disabled={desactivada}
      title={titulo}
      className={activa ? 'border-accent/50 text-accent bg-accent-soft' : ''}
    >
      <Icono className={`w-4 h-4 shrink-0 ${activa && Icono === Bookmark ? 'fill-current' : ''} ${girando ? 'animate-spin' : ''}`} />
      {texto}
    </SecondaryButton>
  );
}

export function Borrar({ obra, movil, confirmandoBorrado, alBorrar, alPedirBorrado, alCancelarBorrado }) {
  const { t } = useI18n();
  if (confirmandoBorrado) {
    return (
      <div className={`flex items-center gap-2 ${movil ? 'w-full' : 'ml-auto'}`}>
        <span className={`text-small text-text-secondary whitespace-nowrap ${movil ? 'flex-1' : ''}`}>{t('detail.delete_sure')}</span>
        <DestructiveButton solid onClick={() => alBorrar(obra.id)}>
          {t('common.confirm')}
        </DestructiveButton>
        <SecondaryButton onClick={alCancelarBorrado}>
          {t('common.cancel')}
        </SecondaryButton>
      </div>
    );
  }
  return (
    <DestructiveButton
      icon={Trash2}
      onClick={() => alPedirBorrado(obra.id)}
      className={movil ? 'w-full' : 'ml-auto'}
    >
      {t('common.delete')}
    </DestructiveButton>
  );
}
