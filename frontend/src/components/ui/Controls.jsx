import { Check, Search, X } from 'lucide-react';

export function Switch({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange?.(!checked);
      }}
      className={`relative inline-flex w-[44px] h-[26px] after:content-[''] after:absolute after:-inset-2 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 disabled:cursor-not-allowed ${
        checked ? 'bg-accent' : 'bg-surface-hover border border-border'
      } ${className}`}
    >
      <span
        className={`block w-[22px] h-[22px] rounded-full bg-white shadow-xs transition-transform duration-150 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function moverSegmento(e, idx, options, onChange) {
  let sig = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') sig = (idx + 1) % options.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') sig = (idx - 1 + options.length) % options.length;
  else if (e.key === 'Home') sig = 0;
  else if (e.key === 'End') sig = options.length - 1;
  if (sig < 0) return;
  e.preventDefault();
  onChange?.(options[sig].id);
  const botones = e.currentTarget.parentElement?.querySelectorAll('button');
  botones?.[sig]?.focus();
}

export function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  showCheck = false,
  className = ''
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center gap-[3px] rounded-md bg-surface-secondary p-[3px] min-h-[var(--control-segmented-h)] border border-border/50 ${className}`}
    >
      {options.map((opt, idx) => {
        const active = value === opt.id;
        const Icon = opt.icono || opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange?.(opt.id)}
            onKeyDown={(e) => moverSegmento(e, idx, options, onChange)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[7px] px-3 py-1.5 min-h-[calc(var(--control-segmented-h)-6px)] max-md:min-h-[var(--control-touch-min)] text-small transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
              active
                ? 'bg-surface text-text-primary font-semibold shadow-xs border border-border/60'
                : 'text-text-secondary hover:text-text-primary font-normal'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{opt.etiqueta ?? opt.label}</span>
            {showCheck && active && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearLabel,
  type = 'search',
  enterKeyHint = 'search',
  autoFocus = false,
  className = ''
}) {
  return (
    <div
      className={`flex items-center gap-2 w-full min-h-[var(--control-search-h)] px-3.5 rounded-md bg-surface-secondary border border-border/60 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 transition-all duration-150 ${className}`}
    >
      <Search className="w-4 h-4 text-text-secondary shrink-0" />
      <input
        type={type}
        enterKeyHint={enterKeyHint}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 bg-transparent text-base md:text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          aria-label={clearLabel || 'Limpiar'}
          className="w-7 h-7 max-md:w-11 max-md:h-11 max-md:-mr-2 rounded-full inline-flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
