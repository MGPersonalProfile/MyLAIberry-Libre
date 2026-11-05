import { useState } from 'react';
import { SecondaryButton } from '../ui/Buttons';
import { useI18n } from '../../i18n/I18nContext';

export default function VolverABiblioteca({ pideReiniciar = false }) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(null);

  const elegir = async () => {
    setEstado(null);
    try {
      const r = await window.api.abrirBibliotecaExistente();
      if (r?.status === 'ok') setEstado(r.reiniciar ? { tipo: 'reiniciar', obras: r.obras } : { tipo: 'ya', obras: r.obras });
      else if (r?.status === 'error') setEstado({ tipo: 'error', texto: r.message });
    } catch (e) { setEstado({ tipo: 'error', texto: e?.message }); }
  };

  if (!window.api.abrirBibliotecaExistente) return null;
  return (
    <div className="mt-3" data-volver-biblioteca>
      <SecondaryButton onClick={elegir}>
        {t('storage.open_existing')}
      </SecondaryButton>
      {estado?.tipo === 'ya' && <p className="text-footnote text-text-secondary mt-2">{t('storage.already_open', { n: estado.obras })}</p>}
      {estado?.tipo === 'error' && <p className="text-footnote text-danger mt-2" role="alert">{estado.texto}</p>}
      {(estado?.tipo === 'reiniciar' || pideReiniciar) && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-footnote text-warning">
            {estado?.tipo === 'reiniciar' ? t('storage.restart_to_open', { n: estado.obras }) : t('storage.restart_pending')}
          </p>
          <button onClick={() => window.api.reiniciarApp()} className="text-footnote text-accent font-medium underline py-1 whitespace-nowrap">
            {t('storage.restart_now')}
          </button>
        </div>
      )}
    </div>
  );
}
