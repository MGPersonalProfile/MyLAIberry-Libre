import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

export default function ImportarWeb({ url, alImportar }) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  async function actuar(navegador) {
    setError(''); setAviso(''); setOcupado(true);
    try {
      const r = navegador ? await window.api.abrirImportadorWeb(url || undefined) : await window.api.importarEnlaceLibro(url);
      if (r?.status === 'error') throw new Error(r.message);
      if (navegador) setAviso(t('import.web_hint')); else alImportar?.();
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  return <div className="mt-3 space-y-2 text-sm">
    {url && <button disabled={ocupado} onClick={() => actuar(false)} className="w-full text-gray-300 p-2 disabled:opacity-40">
      {t('import.download_link')}
    </button>}
    {window.api?.abrirImportadorWeb && <button disabled={ocupado} onClick={() => actuar(true)} className="w-full text-gray-300 p-2 disabled:opacity-40">
      {t('import.web')}
    </button>}
    {ocupado && <p role="status">{t('import.starting')}</p>}
    {aviso && <p role="status" className="text-gray-400">{aviso}</p>}
    {error && <p role="alert" className="text-amber-400">{error}</p>}
  </div>;
}
