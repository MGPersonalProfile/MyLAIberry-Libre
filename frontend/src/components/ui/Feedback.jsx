import { Info, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

export function Girando({ className = '', ...props }) {
  return <Loader2 {...props} className={`${className} animate-spin`} />;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`max-w-[360px] mx-auto py-16 px-4 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-surface-secondary border border-border/60 flex items-center justify-center text-text-tertiary">
          <Icon className="w-6 h-6" strokeWidth={1.6} />
        </div>
      )}
      {title && <p className="text-title-3 text-text-primary">{title}</p>}
      {description && <p className="text-small text-text-secondary">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

const VARIANTES_NOTICE = {
  info: {
    icono: Info,
    caja: 'bg-surface-secondary border-border text-text-secondary',
    acento: 'text-accent'
  },
  success: {
    icono: CheckCircle2,
    caja: 'bg-success/10 border-success/30 text-text-primary',
    acento: 'text-success'
  },
  warning: {
    icono: AlertTriangle,
    caja: 'bg-warning/10 border-warning/35 text-text-primary',
    acento: 'text-warning'
  },
  error: {
    icono: AlertCircle,
    caja: 'bg-destructive/10 border-destructive/35 text-text-primary',
    acento: 'text-destructive'
  }
};

export function Notice({
  variant,
  tone,
  title,
  children,
  action,
  role,
  compact = false,
  className = '',
  ...props
}) {
  const v = (tone || variant || 'info') === 'danger' ? 'error' : (tone || variant || 'info');
  const conf = VARIANTES_NOTICE[v] || VARIANTES_NOTICE.info;
  const Icon = conf.icono;
  const papel = role || (v === 'error' || v === 'warning' ? 'alert' : 'status');

  return (
    <div
      role={papel}
      className={`rounded-lg border flex items-start gap-3 ${
        compact ? 'px-3 py-2 text-footnote' : 'p-4 text-small'
      } ${conf.caja} ${className}`}
      {...props}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${conf.acento}`} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-text-primary mb-0.5">{title}</p>}
        <div className={v === 'error' ? 'text-destructive' : v === 'warning' ? 'text-warning' : 'text-text-secondary'}>
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ProgressIndicator({ value = 0, label, rightLabel, thin = false, className = '', ...props }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={className} {...props}>
      {(label || rightLabel) && (
        <div className="flex justify-between text-footnote text-text-secondary mb-1.5">
          <span>{label}</span>
          {rightLabel && <span className="tabular-nums">{rightLabel}</span>}
        </div>
      )}
      <div className={`w-full ${thin ? 'h-1' : 'h-1.5'} bg-surface-secondary rounded-full overflow-hidden`}>
        <div
          className="h-full bg-accent rounded-full transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const TONOS_TAG = {
  neutral: 'border-border/60 bg-surface-secondary text-text-secondary',
  accent: 'border-accent/35 bg-accent-soft text-accent font-medium',
  success: 'border-success/35 bg-success/15 text-success font-medium',
  warning: 'border-warning/35 bg-warning/15 text-warning font-medium',
  danger: 'border-destructive/35 bg-destructive/15 text-destructive font-medium'
};

export function Tag({ children, active = false, tone = 'neutral', onClick, className = '', ...props }) {
  const tonoCls = TONOS_TAG[tone] || TONOS_TAG.neutral;
  const estilos = active
    ? 'bg-accent-soft text-accent border-accent/40 font-semibold'
    : `${tonoCls} hover:text-text-primary hover:bg-surface-hover`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border text-footnote transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${estilos} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border text-caption ${
        active ? 'bg-accent-soft text-accent border-accent/40 font-semibold' : tonoCls
      } ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
