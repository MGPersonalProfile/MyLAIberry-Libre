import { useState } from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { IconButton, PrimaryButton, SecondaryButton } from './ui/Buttons';
import { Notice } from './ui/Feedback';
import { Card } from './ui/Layout';
import useActualizacion from '../hooks/useActualizacion';
import { pedirAlAsistente } from '../preguntaAlAsistente';

export default function AvisoDeVersion() {
  const { t } = useI18n();
  const { estado, instalando, error, actualizar } = useActualizacion();
  const [cerrado, setCerrado] = useState(false);

  if (!estado?.disponible || cerrado || !window.api?.instalarActualizacion) return null;

  return (
    <Card className="fixed bottom-4 right-4 z-[300] max-w-sm shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-body-emphasis text-text-primary">{t('update.available', { version: estado.nueva })}</p>
          {error && <Notice tone="error" compact className="mt-2">{error}</Notice>}
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton icon={Download} onClick={actualizar} disabled={instalando}>
              {instalando ? t('update.installing') : t('update.install')}
            </PrimaryButton>
            <SecondaryButton icon={Sparkles} onClick={() => { pedirAlAsistente(t('update.whats_new_question')); }}>
              {t('update.whats_new')}
            </SecondaryButton>
          </div>
        </div>
        <IconButton size="sm" icon={X} onClick={() => setCerrado(true)} label={t('common.close')} />
      </div>
    </Card>
  );
}
