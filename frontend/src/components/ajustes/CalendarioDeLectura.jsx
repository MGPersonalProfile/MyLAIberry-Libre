import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { IconButton } from '../ui/Buttons';

const dosCifras = n => String(n).padStart(2, '0');

export default function CalendarioDeLectura({ calendario }) {
  const { lang } = useI18n();
  const hoy = new Date();
  const [mes, setMes] = useState({ a: hoy.getFullYear(), m: hoy.getMonth() });
  const primero = new Date(Date.UTC(mes.a, mes.m, 1));
  const huecos = (primero.getUTCDay() + 6) % 7;
  const dias = new Date(Date.UTC(mes.a, mes.m + 1, 0)).getUTCDate();
  const titulo = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero);
  const mover = d => setMes(({ a, m }) => { const n = new Date(Date.UTC(a, m + d, 1)); return { a: n.getUTCFullYear(), m: n.getUTCMonth() }; });
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];

  return (
    <div className="mt-3" data-testid="calendario-lectura">
      <div className="flex items-center justify-between mb-2">
        <IconButton size="sm" icon={ChevronLeft} onClick={() => mover(-1)} label="mes anterior" />
        <span className="text-footnote text-text-secondary capitalize">{titulo}</span>
        <IconButton size="sm" icon={ChevronRight} onClick={() => mover(1)} label="mes siguiente" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (!d) return <span key={`h${i}`} />;
          const clave = `${mes.a}-${dosCifras(mes.m + 1)}-${dosCifras(d)}`;
          const min = calendario?.[clave] || 0;
          const fuerza = min ? Math.min(1, 0.25 + min / 60) : 0;
          return (
            <span
              key={clave} title={min ? `${clave} · ${Math.round(min)} min` : clave}
              style={min ? { backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(fuerza * 100)}%, transparent)` } : undefined}
              className={`aspect-square flex items-center justify-center rounded-md text-caption tabular-nums ${min ? 'text-text-primary' : 'text-text-tertiary bg-surface-secondary'}`}
            >{d}</span>
          );
        })}
      </div>
    </div>
  );
}
