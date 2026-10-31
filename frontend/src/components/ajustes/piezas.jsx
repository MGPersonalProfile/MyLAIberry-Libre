import { Check } from 'lucide-react';

export function Seccion({ icono: Icono, titulo, descripcion, children }) {
  return (
    <section className="border-t border-white/10 py-6 md:py-8">
      <div className="flex items-start gap-4 mb-5">
        <Icono className="w-5 h-5 mt-0.5 text-gray-500 shrink-0" strokeWidth={1.5} />
        <div>
          <h3 className="text-lg font-bold text-white leading-tight">{titulo}</h3>
          {descripcion && <p className="text-sm text-gray-500 mt-1 max-w-xl">{descripcion}</p>}
        </div>
      </div>
      <div className="md:pl-9">{children}</div>
    </section>
  );
}

export function Dato({ valor, etiqueta, detalle }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
      <span className="block text-2xl font-bold text-white tabular-nums leading-none">{valor}</span>
      <span className="block text-[11px] uppercase tracking-wider text-gray-500 mt-2">{etiqueta}</span>
      {detalle && <span className="block text-xs text-gray-600 mt-1">{detalle}</span>}
    </div>
  );
}

export function Interruptor({ activo, onChange, titulo, descripcion }) {
  return (
    <button
      onClick={() => onChange(!activo)}
      role="switch"
      aria-checked={activo}
      className="w-full min-h-11 flex items-start gap-4 text-left group"
    >
      <span
        className={`mt-0.5 w-11 h-6 rounded-full shrink-0 transition-colors relative ${
          activo ? 'bg-red-600' : 'bg-white/15 group-hover:bg-white/25'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
            activo ? 'left-6' : 'left-1'
          }`}
        />
      </span>
      <span>
        <span className="block text-sm text-white font-medium">{titulo}</span>
        <span className="block text-xs text-gray-500 mt-0.5 max-w-lg">{descripcion}</span>
      </span>
    </button>
  );
}

export function Opciones({ valor, opciones, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {opciones.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-4 py-2 max-md:min-h-11 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
            valor === o.id
              ? 'border-red-500 text-red-500 bg-red-500/10'
              : 'border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/25'
          }`}
        >
          {o.icono && <o.icono className="w-4 h-4" />}
          {o.etiqueta}
          {valor === o.id && <Check className="w-3.5 h-3.5" />}
        </button>
      ))}
    </div>
  );
}
