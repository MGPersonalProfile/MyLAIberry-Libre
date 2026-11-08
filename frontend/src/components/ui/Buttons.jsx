const BASE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed';

function claseTamanoBoton(size) {
  return size === 'sm'
    ? 'px-3 min-h-[var(--control-btn-sm-h)] text-small'
    : 'px-4 min-h-[var(--control-btn-h)] text-body';
}

export function PrimaryButton({
  children,
  icon: Icon,
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`${BASE_BTN} ${claseTamanoBoton(size)} bg-accent hover:bg-accent-hover text-white font-semibold ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  icon: Icon,
  size = 'md',
  as: Elemento = 'button',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <Elemento
      type={Elemento === 'button' ? type : undefined}
      className={`${BASE_BTN} ${claseTamanoBoton(size)} bg-surface-secondary hover:bg-surface-hover text-text-primary border border-border/70 font-medium ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </Elemento>
  );
}

export function DestructiveButton({
  children,
  icon: Icon,
  solid = false,
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const variante = solid
    ? 'bg-destructive hover:opacity-90 text-white font-semibold'
    : 'bg-surface-secondary hover:bg-surface-hover text-destructive border border-destructive/35 font-medium';
  return (
    <button
      type={type}
      className={`${BASE_BTN} ${claseTamanoBoton(size)} ${variante} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  children,
  label,
  size = 'md',
  active = false,
  className = '',
  type = 'button',
  ...props
}) {
  const ariaLabel = props['aria-label'] || label || props.title;
  const title = props.title || label;
  const dimCls = size === 'sm'
    ? 'min-w-[var(--control-btn-sm-h)] min-h-[var(--control-btn-sm-h)] p-1'
    : 'min-w-[var(--control-touch-min)] min-h-[var(--control-touch-min)] p-1.5';
  const iconCls = size === 'sm' ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0';

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex items-center justify-center rounded-md ${dimCls} transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent-soft text-accent'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
      } ${className}`}
      {...props}
    >
      {Icon ? <Icon className={iconCls} /> : children}
    </button>
  );
}
