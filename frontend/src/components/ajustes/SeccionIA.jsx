import { Sparkles } from 'lucide-react';

import { Seccion, Opciones } from './piezas';
import { PrimaryButton } from '../ui/Buttons';
import { Notice } from '../ui/Feedback';
import { useI18n } from '../../i18n/I18nContext';

export default function SeccionIA({
  proveedores, proveedorActual, ajustes, claveNueva, alEscribirClave,
  probando, prueba, alGuardarAjuste, alGuardarDiferido, alVolcar,
  alGuardarClave, alBorrarClave, alProbar, alAbrirEnNavegador
}) {
  const { t } = useI18n();
  return (
    <Seccion icono={Sparkles} titulo={t('settings.recap_ai')} descripcion={t('settings.recap_ai_desc')}>
      <div className="space-y-5 max-w-xl">
        <div>
          <label className="block text-caption uppercase tracking-wider text-text-secondary mb-2">
            {t('settings.ai_provider')}
          </label>
          <Opciones
            valor={ajustes.proveedorIA || 'gemini'}
            opciones={proveedores.map(p => ({
              id: p.id,
              etiqueta: p.gratis ? `${p.nombre} · ${t('settings.ai_free_tier')}` : p.nombre
            }))}
            onChange={(id) => alGuardarAjuste({ proveedorIA: id })}
          />
          {proveedorActual?.dondeSacarla && (
            <button
              onClick={() => alAbrirEnNavegador(proveedorActual.dondeSacarla)}
              className="text-footnote text-text-secondary hover:text-text-primary underline underline-offset-2 mt-2 inline-block"
            >
              {t('settings.ai_get_key')} ↗
            </button>
          )}
        </div>

        {proveedorActual?.necesitaDireccion && (
          <div>
            <label className="block text-caption uppercase tracking-wider text-text-secondary mb-2">
              {t('settings.ai_address')}
            </label>
            <input
              value={ajustes.direccionIA || ''}
              onChange={(e) => alGuardarDiferido({ direccionIA: e.target.value })}
              onBlur={alVolcar}
              placeholder="https://openrouter.ai/api/v1"
              spellCheck={false}
              className="w-full bg-surface-secondary border border-border rounded-md px-4 py-2 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent font-mono"
            />
            <p className="text-footnote text-text-tertiary mt-1.5">{t('settings.ai_address_help')}</p>
          </div>
        )}

        <div>
          <label className="block text-caption uppercase tracking-wider text-text-secondary mb-2">
            {t('settings.ai_model')}
          </label>
          <input
            value={ajustes.modeloIA || ''}
            onChange={(e) => alGuardarDiferido({ modeloIA: e.target.value })}
            onBlur={alVolcar}
            placeholder={proveedorActual?.modeloPorDefecto || ''}
            spellCheck={false}
            className="w-full bg-surface-secondary border border-border rounded-md px-4 py-2 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent font-mono"
          />
          <p className="text-footnote text-text-tertiary mt-1.5">{t('settings.ai_model_help')}</p>
        </div>

        <div>
          <label className="block text-caption uppercase tracking-wider text-text-secondary mb-2">
            {t('settings.recap_ai_placeholder')}
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              type="password"
              value={claveNueva}
              onChange={(e) => alEscribirClave(e.target.value)}
              onBlur={alGuardarClave}
              placeholder={ajustes.tieneClaveIA ? '••••••••••••' : t('settings.recap_ai_placeholder')}
              spellCheck={false}
              className="flex-1 min-w-[16rem] bg-surface-secondary border border-border rounded-md px-4 py-2 text-callout text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent font-mono"
            />
            <PrimaryButton onClick={alProbar} disabled={probando}>
              {probando ? t('settings.ai_testing') : t('settings.ai_test')}
            </PrimaryButton>
          </div>

          {ajustes.claveIAIlegible && (
            <Notice tone="warning" className="mt-2">
              {t(ajustes.tieneClaveIA ? 'settings.ai_key_other_device_file' : 'settings.ai_key_other_device')}
            </Notice>
          )}
          {ajustes.tieneClaveIA && ajustes.claveIAOrigen === 'fichero' && !ajustes.claveIAIlegible && (
            <p className="text-footnote text-text-secondary mt-2">{t('settings.ai_key_from_file')}</p>
          )}

          {ajustes.tieneClaveIA && ajustes.claveIAOrigen === 'ajustes' && (
            <p className="text-footnote text-text-secondary mt-2">
              {t('settings.ai_key_saved')}{' '}
              <span className="text-text-tertiary">{t('settings.ai_key_replace')}</span>
              {' · '}
              <button onClick={alBorrarClave} className="text-text-secondary hover:text-danger underline underline-offset-2">
                {t('settings.ai_key_clear')}
              </button>
            </p>
          )}

          {prueba && (
            <Notice tone={prueba.ok ? 'success' : 'danger'} className="mt-2">
              {prueba.ok
                ? t('settings.ai_test_ok') + '“' + (prueba.muestra || '') + '”'
                : t('settings.ai_test_fail') + (prueba.message || prueba.codigo || '')}
            </Notice>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <p className={`text-footnote max-w-xl ${ajustes.cifradoDisponible === false ? 'text-warning' : 'text-text-secondary'}`}>
            {ajustes.cifradoDisponible === false
              ? t('settings.ai_key_plain')
              : t('settings.ai_key_encrypted')}
          </p>
          <p className="text-footnote text-warning max-w-xl">{t('settings.recap_ai_warning')}</p>
        </div>
      </div>
    </Seccion>
  );
}
