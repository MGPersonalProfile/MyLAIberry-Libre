import { useState, useEffect, useRef } from 'react';
import { DialogSheet } from './ui/Layout';
import { useI18n } from '../i18n/I18nContext';
import FormularioImportar from './importar/FormularioImportar';
import EstadoProgreso from './importar/EstadoProgreso';

const LIBRO = Symbol('libro');

function useDetectarSitio(url, t) {
  const [detectedSite, setDetectedSite] = useState(null);
  const detectTimeout = useRef(null);

  useEffect(() => {
    if (detectTimeout.current) clearTimeout(detectTimeout.current);
    const urlUtil = url.trim().length > 10 && url.includes('.');

    detectTimeout.current = setTimeout(async () => {
      if (!urlUtil) { setDetectedSite(null); return; }
      if (window.api && window.api.detectSite) {
        const result = await window.api.detectSite(url.trim());
        setDetectedSite(result);
      } else if (url.includes('royalroad.com')) setDetectedSite({ name: 'RoyalRoad', tier: 1 });
      else if (url.includes('archiveofourown.org')) setDetectedSite({ name: 'AO3', tier: 1 });
      else if (url.includes('fanfiction.net')) setDetectedSite({ name: 'FanFiction.net', tier: 1 });
      else if (url.includes('spacebattles.com')) setDetectedSite({ name: 'SpaceBattles', tier: 2 });
      else if (url.includes('gutenberg.org')) setDetectedSite({ name: 'Project Gutenberg', tier: 1 });
      else setDetectedSite({ name: t('import.generic_site'), tier: 3 });
    }, 300);

    return () => clearTimeout(detectTimeout.current);
  }, [url, t]);

  return [detectedSite, setDetectedSite];
}

function useProgresoImportacion(isOpen, enCursoRef, alTerminarRef, cerrarRef, setProgressMsg, setDetails, setStatus) {
  useEffect(() => {
    if (!isOpen || !window.api) return;
    let cierre = null;

    const cancelar = window.api.onScrapeProgress((data) => {
      const pedido = enCursoRef.current;
      if (!pedido || (pedido === LIBRO ? !!data.url : data.url !== pedido)) return;
      setProgressMsg(data.message);
      if (data.details) setDetails(data.details);

      if (data.step === 'error') {
        setStatus('error');
      } else if (data.step === 'complete') {
        setStatus('success');
        cierre = setTimeout(() => {
          cierre = null;
          alTerminarRef.current?.();
          cerrarRef.current?.();
        }, 2000);
      }
    });

    return () => {
      if (cierre) clearTimeout(cierre);
      if (typeof cancelar === 'function') cancelar();
    };
  }, [isOpen, enCursoRef, alTerminarRef, cerrarRef, setProgressMsg, setDetails, setStatus]);
}

export default function ImportModal({ isOpen, onClose, onImportSuccess, urlInicial }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [details, setDetails] = useState('');
  const [detectedSite, setDetectedSite] = useDetectarSitio(url, t);

  const alTerminarRef = useRef(onImportSuccess);
  const cerrarRef = useRef(null);
  const enCursoRef = useRef(null);
  const ficheroRef = useRef(null);

  useEffect(() => {
    alTerminarRef.current = onImportSuccess;
    cerrarRef.current = handleClose;
  });

  useProgresoImportacion(isOpen, enCursoRef, alTerminarRef, cerrarRef, setProgressMsg, setDetails, setStatus);

  const [ultimaEntrante, setUltimaEntrante] = useState(null);
  if (urlInicial !== ultimaEntrante) {
    setUltimaEntrante(urlInicial);
    if (urlInicial) {
      setUrl(urlInicial);
      setStatus('idle');
    }
  }

  function handleClose() {
    enCursoRef.current = null;
    setUrl('');
    setStatus('idle');
    setProgressMsg('');
    setDetails('');
    setDetectedSite(null);
    onClose();
  }

  const iniciarAccion = async (claveRef, msgInicial, accion) => {
    enCursoRef.current = claveRef;
    setStatus('scraping');
    setProgressMsg(msgInicial);
    setDetails('');
    try {
      const r = await accion();
      if (r?.status === 'cancelled') setStatus('idle');
      else if (r?.status === 'error') {
        setStatus('error');
        setProgressMsg(t('import.error'));
        setDetails(r.message);
      }
    } catch (err) {
      setStatus('error');
      setProgressMsg(t('import.error'));
      setDetails(err?.message || '');
    }
  };

  const handleImport = () => {
    if (!url.trim()) return;
    if (!window.api) { setStatus('error'); setProgressMsg(t('import.error')); return; }
    iniciarAccion(url, t('import.starting'), () => window.api.scrapeStory(url));
  };

  const handleImportarLibro = () => {
    iniciarAccion(LIBRO, t('import.reading_file'), async () => {
      const r = await window.api?.importarLibro?.();
      return r || { status: 'cancelled' };
    });
  };

  const handleSubirLibro = async (fichero) => {
    if (!fichero) return;
    await iniciarAccion(LIBRO, t('import.uploading', { n: 0 }), async () => {
      setDetails(fichero.name);
      const r = await window.api.subirLibro(fichero, n => setProgressMsg(t('import.uploading', { n })));
      if (r?.status === 'success') {
        setStatus('success');
        setProgressMsg(t(r.yaEstaba ? 'import.already_had' : 'import.imported_named', { titulo: r.data?.title || fichero.name }));
        setTimeout(() => { alTerminarRef.current?.(); cerrarRef.current?.(); }, 2000);
      }
      return r;
    });
    if (ficheroRef.current) ficheroRef.current.value = '';
  };

  if (!isOpen) return null;

  const puedeDisco = Boolean(status === 'idle' && window.api?.importarLibro);
  const puedeSubir = Boolean(status === 'idle' && !window.api?.importarLibro && window.api?.subirLibro);

  return (
    <DialogSheet
      title={t('import.title')}
      subtitle={t('import.subtitle')}
      onClose={status !== 'scraping' ? handleClose : undefined}
      closeLabel={t('common.close')}
      maxWidth="max-w-lg"
      bodyClassName="p-6"
    >
      {puedeSubir && (
        <input
          ref={ficheroRef}
          type="file"
          accept=".epub,.pdf,.html,.htm,application/epub+zip,application/pdf,text/html"
          className="hidden"
          data-subir-libro
          onChange={(e) => handleSubirLibro(e.target.files?.[0])}
        />
      )}
      <FormularioImportar
        url={url}
        setUrl={setUrl}
        status={status}
        detectedSite={detectedSite}
        puedeDisco={puedeDisco}
        puedeSubir={puedeSubir}
        onImport={handleImport}
        onImportarLibro={handleImportarLibro}
        onPedirSubida={() => ficheroRef.current?.click()}
        onImportSuccess={onImportSuccess}
        onClose={handleClose}
      >
        <EstadoProgreso status={status} progressMsg={progressMsg} details={details} />
      </FormularioImportar>
    </DialogSheet>
  );
}
