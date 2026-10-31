import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Loader2, CheckCircle2, AlertCircle, Globe, Zap, Server } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import ImportarWeb from './ImportarWeb';

const LIBRO = Symbol('libro');

export default function ImportModal({ isOpen, onClose, onImportSuccess, urlInicial }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [details, setDetails] = useState('');
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
      } else {

        if (url.includes('royalroad.com')) setDetectedSite({ name: 'RoyalRoad', tier: 1 });
        else if (url.includes('archiveofourown.org')) setDetectedSite({ name: 'AO3', tier: 1 });
        else if (url.includes('fanfiction.net')) setDetectedSite({ name: 'FanFiction.net', tier: 1 });
        else if (url.includes('spacebattles.com')) setDetectedSite({ name: 'SpaceBattles', tier: 2 });
        else if (url.includes('gutenberg.org')) setDetectedSite({ name: 'Project Gutenberg', tier: 1 });
        else setDetectedSite({ name: t('import.generic_site'), tier: 3 });
      }
    }, 300);

    return () => clearTimeout(detectTimeout.current);
  }, [url, t]);

  const alTerminarRef = useRef(onImportSuccess);
  const cerrarRef = useRef(null);

  const enCursoRef = useRef(null);

  useEffect(() => {
    alTerminarRef.current = onImportSuccess;
    cerrarRef.current = handleClose;
  });

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
  }, [isOpen]);

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

  const handleImport = async () => {
    if (!url.trim()) return;
    enCursoRef.current = url;
    setStatus('scraping');
    setProgressMsg(t('import.starting'));
    setDetails('');

    if (window.api) {

      try {
        const result = await window.api.scrapeStory(url);
        if (result?.status === 'error') {
          setStatus('error');
          setProgressMsg(t('import.error'));
          setDetails(result.message);
        }
      } catch (err) {
        setStatus('error');
        setProgressMsg(t('import.error'));
        setDetails(err?.message || '');
      }
    } else {

      setStatus('error');
      setProgressMsg(t('import.error'));
    }
  };

  const handleImportarLibro = async () => {
    enCursoRef.current = LIBRO;
    setStatus('scraping');
    setProgressMsg(t('import.reading_file'));
    setDetails('');
    try {
      const r = await window.api?.importarLibro?.();
      if (!r || r.status === 'cancelled') setStatus('idle');
      else if (r.status === 'error') {
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

  const tierIcons = {
    1: <Zap className="w-4 h-4" />,
    2: <Server className="w-4 h-4" />,
    3: <Globe className="w-4 h-4" />
  };
  const tierLabels = {
    1: t('import.tier_native'),
    2: t('import.tier_fichub'),
    3: t('import.tier_universal')
  };
  const tierColors = {
    1: 'text-green-400 bg-green-500/10 border-green-500/20',
    2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    3: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={status !== 'scraping' ? handleClose : undefined}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-t-2xl md:rounded-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:p-8 shadow-2xl overflow-hidden"
          >

            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 opacity-80" />

            <button
              onClick={handleClose}
              disabled={status === 'scraping'}
              className="absolute top-4 right-4 p-2 max-md:w-11 max-md:h-11 max-md:grid max-md:place-items-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-2 text-white">{t('import.title')}</h2>
            <p className="text-gray-400 mb-6 text-sm">
              {t('import.subtitle')}
            </p>

            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link2 className="w-5 h-5 text-gray-500" />
              </div>
              <input
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="go"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={status === 'scraping'}
                placeholder={t('import.placeholder')}
                className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              />
            </div>

            <AnimatePresence>
              {detectedSite && status === 'idle' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${tierColors[detectedSite.tier]}`}>
                    {tierIcons[detectedSite.tier]}
                    <span className="font-bold">{detectedSite.name}</span>
                    <span className="opacity-60">·</span>
                    <span className="opacity-60">{tierLabels[detectedSite.tier]}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!detectedSite && status === 'idle' && (
              <p className="text-xs text-gray-600 mb-4">
                {t('import.supports')}
              </p>
            )}

            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.button
                  key="btn-idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={handleImport}
                  className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t('import.extract')}
                </motion.button>
              )}

              {status === 'scraping' && (
                <motion.div
                  key="status-scraping"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl py-4 px-6 flex items-center gap-4"
                >
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{progressMsg}</p>
                    {details && <p className="text-xs text-gray-500 truncate">{details}</p>}
                  </div>
                </motion.div>
              )}

              {status === 'success' && (
                <motion.div
                  key="status-success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full bg-green-500/10 border border-green-500/20 rounded-xl py-4 px-6 flex items-center gap-4 text-green-400"
                >
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <p className="font-medium">{progressMsg}</p>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="status-error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full bg-red-500/10 border border-red-500/20 rounded-xl py-4 px-6 flex items-start gap-4 text-red-400"
                >
                  <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{progressMsg}</p>
                    {details && <p className="text-xs text-red-400/70 mt-1">{details}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {status === 'idle' && window.api?.importarLibro && (
              <button
                type="button"
                onClick={handleImportarLibro}
                className="w-full mt-3 text-sm text-gray-400 hover:text-white underline decoration-dotted transition-colors"
              >
                {t('import.from_disk')}
              </button>
            )}
            {status === 'idle' && <ImportarWeb url={url.trim()} alImportar={() => { onImportSuccess?.(); handleClose(); }} />}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
