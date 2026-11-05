import { ChevronRight } from 'lucide-react';
import { pulsable } from '../../pulsable';

export function InsetGroupedList({
  header,
  footer,
  padded = false,
  divided = false,
  className = '',
  children,
  ...props
}) {
  return (
    <div className={className} {...props}>
      {header}
      <div
        className={`rounded-xl bg-surface border border-border/70 overflow-hidden ${
          divided ? 'divide-y divide-separator' : ''
        } ${padded ? 'p-4 md:p-5' : ''}`}
      >
        {children}
      </div>
      {footer && (
        <div className="mt-2 px-1 text-footnote text-text-secondary">
          {footer}
        </div>
      )}
    </div>
  );
}

function IconoDeCelda({ Icon, iconBg }) {
  if (!Icon) return null;
  if (typeof Icon === 'function' && Icon.prototype === undefined && Icon.length === 0) {
    return <Icon />;
  }
  return (
    <span className={`w-8 h-8 rounded-sm inline-flex items-center justify-center shrink-0 ${iconBg || 'bg-surface-secondary text-text-secondary'}`}>
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
}

export function ActionCell({
  icon: Icon,
  iconBg = '',
  title,
  subtitle,
  description,
  detail,
  value,
  trailing,
  control,
  chevron = false,
  navigation = false,
  onClick,
  className = '',
  children
}) {
  const sub = subtitle ?? description;
  const val = detail ?? value;
  const right = trailing ?? control;
  const showChevron = chevron || navigation;
  const interactiva = Boolean(onClick);
  const attrs = !onClick
    ? {}
    : right
      ? { onClick }
      : pulsable(onClick, typeof title === 'string' ? title : undefined);
  const baseCls = `w-full min-h-[var(--control-cell-min-h)] px-4 py-3 flex items-center justify-between gap-4 text-left ${
    interactiva ? 'cursor-pointer hover:bg-surface-hover active:bg-surface-hover transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent' : ''
  } ${className}`;

  return (
    <div className={baseCls} {...attrs}>
      <IconoDeCelda Icon={Icon} iconBg={iconBg} />
      <div className="flex-1 min-w-0">
        {title && <div className="text-body font-medium text-text-primary">{title}</div>}
        {sub && <div className="text-footnote text-text-secondary mt-0.5 max-w-xl">{sub}</div>}
        {children}
      </div>
      {val !== undefined && val !== null && (
        <span className="text-footnote text-text-secondary shrink-0 tabular-nums">{val}</span>
      )}
      {right && <div className="shrink-0 flex items-center">{right}</div>}
      {showChevron && !right && <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />}
    </div>
  );
}

export function Divider({ inset = false, className = '' }) {
  return <hr className={`h-px border-0 bg-separator my-3 ${inset ? 'ml-14' : 'w-full'} ${className}`} />;
}
