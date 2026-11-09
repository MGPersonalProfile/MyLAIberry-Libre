import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { SecondaryButton } from '../ui/Buttons';

export default function ObrasDeSerie({ obra }) {
  const { t } = useI18n();
  const series = Array.isArray(obra?.series) ? obra.series.filter(s => s && s.nombre) : [];
  const primeraSerie = series[0];
  const urlSerie = primeraSerie?.url;

  const [catalogo, setCatalogo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState(null);
  const [errorImportacion, setErrorImportacion] = useState(null);

  useEffect(() => {
    let activo = true;
    if (!urlSerie || !window.api?.obtenerCatalogoSerie) return;

    Promise.resolve().then(() => {
      if (!activo) return;
      setCargando(true);
      setError(null);
      setErrorImportacion(null);
    });

    window.api.obtenerCatalogoSerie(urlSerie, { seriePrevia: primeraSerie })
      .then(res => {
        if (!activo) return;
        setCatalogo(res);
        setCargando(false);
      })
      .catch(err => {
        if (!activo) return;
        setError(err.message || 'Error al consultar la serie');
        setCargando(false);
      });

    return () => { activo = false; };
  }, [urlSerie, primeraSerie]);

  if (!series.length) return null;

  const clasificacion = catalogo?.clasificacion;
  const obras = clasificacion?.todas || catalogo?.obras || [];
  const pendientes = clasificacion?.pendientes || [];

  const alImportarUna = async (item) => {
    if (importando || !window.api?.importarObrasSerie) return;
    setImportando(true);
    setErrorImportacion(null);
    try {
      await window.api.importarObrasSerie([item], { serie: primeraSerie });
      const fresco = await window.api.obtenerCatalogoSerie(primeraSerie.url, { seriePrevia: primeraSerie });
      setCatalogo(fresco);
    } catch (err) {
      setErrorImportacion(err?.message || 'Error al importar obra de la serie');
    } finally {
      setImportando(false);
    }
  };

  const alImportarFaltantes = async () => {
    if (importando || !pendientes.length || !window.api?.importarObrasSerie) return;
    setImportando(true);
    setErrorImportacion(null);
    try {
      await window.api.importarObrasSerie(pendientes, { serie: primeraSerie });
      const fresco = await window.api.obtenerCatalogoSerie(primeraSerie.url, { seriePrevia: primeraSerie });
      setCatalogo(fresco);
    } catch (err) {
      setErrorImportacion(err?.message || 'Error al importar las obras pendientes');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-medium text-neutral-200">
          {t('detail.series_works')}: <span className="text-neutral-400 font-normal">{primeraSerie.nombre}</span>
        </h4>
        {pendientes.length > 0 && (
          <SecondaryButton size="sm" onClick={alImportarFaltantes} disabled={importando}>
            {t('detail.series_import_all')} ({pendientes.length})
          </SecondaryButton>
        )}
      </div>

      {cargando && <p className="text-neutral-500 italic text-xs">{t('detail.series_loading')}</p>}
      {(error || catalogo?.error) && <p className="text-red-400/80 text-xs mb-2">{error || catalogo?.error}</p>}
      {errorImportacion && <p className="text-red-400/80 text-xs mb-2">{errorImportacion}</p>}
      {catalogo?.parcial && (
        <span className="inline-block mb-2 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50">
          {t('detail.series_partial')}
        </span>
      )}

      {obras.length > 0 && (
        <ul className="space-y-1.5 divide-y divide-neutral-800/50">
          {obras.map((item, idx) => (
            <li key={item.url || idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-neutral-800 text-[10px] text-neutral-400">
                  {item.posicion !== null && item.posicion !== undefined ? item.posicion : '·'}
                </span>
                <span className="truncate text-neutral-300" title={item.titulo}>{item.titulo}</span>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {item.enBiblioteca ? (
                  <span className="text-[11px] text-emerald-400/90 font-medium">
                    {t('detail.series_in_library')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => alImportarUna(item)}
                    disabled={importando}
                    className="px-2 py-0.5 rounded text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                  >
                    {t('detail.series_import_btn')}
                  </button>
                )}
                {item.url && window.api?.abrirEnNavegador && (
                  <button
                    type="button"
                    onClick={() => window.api.abrirEnNavegador(item.url)}
                    className="text-neutral-500 hover:text-neutral-300 p-0.5"
                    title={item.url}
                    aria-label="Abrir enlace original"
                  >
                    ↗
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
