import { useEffect, useState } from 'react';
import { Flame, Download } from 'lucide-react';
import { SecondaryButton } from '../ui/Buttons';
import { useI18n } from '../../i18n/I18nContext';
import CalendarioDeLectura from './CalendarioDeLectura';

const zona = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } };
const minutos = n => (n >= 60 ? `${Math.floor(n / 60)} h ${Math.round(n % 60)} min` : `${Math.round(n)} min`);

function descargar(texto, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Dato({ valor, etiqueta }) {
  return (
    <div className="rounded-md bg-surface-secondary border border-border px-3 py-2">
      <p className="text-callout text-text-primary tabular-nums">{valor}</p>
      <p className="text-caption text-text-secondary">{etiqueta}</p>
    </div>
  );
}

export default function MiLectura() {
  const { t } = useI18n();
  const [e, setE] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    window.api?.estadisticasLectura?.(zona()).then(r => { if (!vivo) return; if (typeof r?.sesiones === 'number') setE(r); else setFallo(true); }).catch(() => { if (vivo) setFallo(true); });
    return () => { vivo = false; };
  }, []);

  const exportar = async (formato) => {
    const texto = await window.api.exportarLectura(formato);
    descargar(texto, `mi-lectura.${formato}`, formato === 'csv' ? 'text/csv' : 'application/json');
  };

  if (fallo) return <p className="text-footnote text-text-secondary">{t('lectura.error')}</p>;
  if (!e) return null;
  return (
    <div data-testid="mi-lectura">
      <p className="text-caption uppercase tracking-wider text-text-secondary mb-2">{t('lectura.titulo')}</p>
      <p className="flex items-center gap-2 text-callout text-text-primary tabular-nums">
        <Flame className="w-4 h-4 text-accent" />
        {t('lectura.racha', { n: e.rachaActual, mejor: e.mejorRacha })}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Dato valor={minutos(e.minutosHoy)} etiqueta={t('lectura.hoy')} />
        <Dato valor={minutos(e.minutos7)} etiqueta={t('lectura.siete')} />
        <Dato valor={minutos(e.minutosTotal)} etiqueta={t('lectura.total')} />
        <Dato valor={e.sesiones} etiqueta={t('lectura.sesiones')} />
        <Dato valor={e.capitulosTerminados} etiqueta={t('lectura.capitulos')} />
        <Dato valor={e.palabrasUnicas.toLocaleString()} etiqueta={t('lectura.palabras')} />
        <Dato valor={e.obrasRetomadas} etiqueta={t('lectura.retomadas')} />
      </div>
      {e.sesiones === 0 && <p className="mt-3 text-footnote text-text-secondary">{t('lectura.vacio')}</p>}
      <CalendarioDeLectura calendario={e.calendario} />
      <div className="flex gap-2 mt-3">
        <SecondaryButton onClick={() => exportar('json')}><Download className="w-4 h-4" /> JSON</SecondaryButton>
        <SecondaryButton onClick={() => exportar('csv')}><Download className="w-4 h-4" /> CSV</SecondaryButton>
      </div>
      <p className="mt-2 text-caption text-text-tertiary">{t('lectura.privado')}</p>
    </div>
  );
}
