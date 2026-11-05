import { FolderCog, FolderOpen } from 'lucide-react';

import { Seccion } from './piezas';
import { PrimaryButton, SecondaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
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
          <p className="font-mono text-footnote text-text-primary break-all bg-surface-secondary border border-border rounded-md px-3 py-2 mb-3">
            {almacen.actual}
          </p>
          <p className="text-footnote text-text-secondary mb-4">
            {almacen.personalizada ? t('settings.custom_location') : t('settings.default_location')}
            {bytes ? ` · ${formatBytes(bytes)}` : ''}
          </p>
          {almacen.punteroRoto && (
            <p className="text-footnote text-warning mb-4" role="alert" data-puntero-roto>
              {t({ ilegible: 'storage.pointer_unreadable', reiniciar: 'storage.pointer_restart' }[almacen.punteroRoto.motivo] || 'storage.pointer_missing', { ruta: almacen.punteroRoto.ruta })}
            </p>
          )}
          {movil ? <p className="text-footnote text-text-secondary">{t('settings.storage_mobile')}</p> : (
          <div className="flex gap-3 flex-wrap">
            <PrimaryButton onClick={alCambiarCarpeta} disabled={moviendo}>
              {moviendo ? t('settings.moving') : t('settings.change_folder')}
            </PrimaryButton>
            <SecondaryButton onClick={alAbrirCarpeta} icon={FolderOpen}>
              {t('settings.open_folder')}
            </SecondaryButton>
          </div>
          )}

          {aviso?.tipo === 'error' && (
            <Notice tone="danger" className="mt-3">
              {t('storage.error')}{aviso.texto ? ` ${aviso.texto}` : ''}
            </Notice>
          )}
          {!movil && <VolverABiblioteca pideReiniciar={almacen.punteroRoto?.motivo === 'reiniciar'} />}
          {!movil && <CopiasDeSeguridad />}
          {aviso?.tipo === 'movida' && (
            <p className="text-footnote text-text-secondary mt-3">
              {t('storage.moved_1')}{' '}
              <span className="font-mono text-text-primary break-all">{aviso.ruta}</span>{' '}
              {t('storage.moved_2')}
            </p>
          )}
        </>
      ) : (
        <p className="text-callout text-text-tertiary">{t('settings.loading')}</p>
      )}
    </Seccion>
  );
}
