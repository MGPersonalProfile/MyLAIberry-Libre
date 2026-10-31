import { FolderCog, FolderOpen } from 'lucide-react';

import { Seccion } from './piezas';
import { formatBytes } from './formato';
import CopiasDeSeguridad from './CopiasDeSeguridad';
import VolverABiblioteca from './VolverABiblioteca';
import { useI18n } from '../../i18n/I18nContext';

export default function SeccionAlmacenamiento({ almacen, bytes, moviendo, aviso, alCambiarCarpeta, alAbrirCarpeta, movil = false }) {
  const { t } = useI18n();
  return (
    <Seccion icono={FolderCog} titulo={t('settings.storage')} descripcion={t('settings.storage_desc')}>
      {almacen ? (
        <>
          <p className="font-mono text-xs text-gray-300 break-all bg-black/40 border border-white/10 rounded px-3 py-2 mb-3">
            {almacen.actual}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {almacen.personalizada ? t('settings.custom_location') : t('settings.default_location')}
            {bytes ? ` · ${formatBytes(bytes)}` : ''}
          </p>
          {almacen.punteroRoto && (
            <p className="text-xs text-amber-300/90 mb-4" role="alert" data-puntero-roto>
              {t({ ilegible: 'storage.pointer_unreadable', reiniciar: 'storage.pointer_restart' }[almacen.punteroRoto.motivo] || 'storage.pointer_missing', { ruta: almacen.punteroRoto.ruta })}
            </p>
          )}
          {movil ? <p className="text-xs text-gray-400">{t('settings.storage_mobile')}</p> : (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={alCambiarCarpeta}
              disabled={moviendo}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {moviendo ? t('settings.moving') : t('settings.change_folder')}
            </button>
            <button
              onClick={alAbrirCarpeta}
              className="px-4 py-2 rounded-lg border border-white/15 text-gray-300 text-sm hover:text-white hover:border-white/30 transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" /> {t('settings.open_folder')}
            </button>
          </div>
          )}

          {aviso?.tipo === 'error' && (
            <p className="text-xs text-red-400 mt-3">
              {t('storage.error')}{aviso.texto ? ` ${aviso.texto}` : ''}
            </p>
          )}
          {!movil && <VolverABiblioteca pideReiniciar={almacen.punteroRoto?.motivo === 'reiniciar'} />}
          {!movil && <CopiasDeSeguridad />}
          {aviso?.tipo === 'movida' && (
            <p className="text-xs text-gray-500 mt-3">
              {t('storage.moved_1')}{' '}
              <span className="font-mono text-gray-400 break-all">{aviso.ruta}</span>{' '}
              {t('storage.moved_2')}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-600">{t('settings.loading')}</p>
      )}
    </Seccion>

  );
}
