import { useState } from 'react';
import { Globe, Download } from 'lucide-react';
import { SecondaryButton } from './ui/Buttons';
import { Notice } from './ui/Feedback';
import { useI18n } from '../i18n/I18nContext';

export default function ImportarWeb({ url, alImportar }) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  async function actuar(navegador) {
    setError(''); setAviso(''); setOcupado(true);
    try {
      const r = navegador
        ? await window.api.abrirImportadorWeb(url || undefined)
        : await window.api.importarEnlaceLibro(url);
      if (r?.status === 'error') throw new Error(r.message);
      if (navegador) setAviso(t('import.web_hint'));
      else alImportar?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-2 text-small">
      {url && (
        <SecondaryButton
          icon={Download}
          disabled={ocupado}
          onClick={() => actuar(false)}
          className="w-full"
        >
          {t('import.download_link')}
        </SecondaryButton>
      )}
      {window.api?.abrirImportadorWeb && (
        <SecondaryButton
          icon={Globe}
          disabled={ocupado}
          onClick={() => actuar(true)}
          className="w-full"
        >
          {t('import.web')}
        </SecondaryButton>
      )}
      {ocupado && <p role="status" className="text-footnote text-text-secondary">{t('import.starting')}</p>}
      {aviso && <Notice variant="info" compact>{aviso}</Notice>}
      {error && <Notice variant="warning" compact>{error}</Notice>}
    </div>
  );
}
