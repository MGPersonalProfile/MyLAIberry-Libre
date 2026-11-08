import { X } from 'lucide-react';
import { IconButton } from './Buttons';
import { pulsable } from '../../pulsable';
import { CLASE_CARD } from './clases';

export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-4 mb-6 md:mb-8 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-title-1 text-text-primary tracking-tight">{title}</h2>
        {subtitle && <p className="text-body text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 max-md:shrink max-md:w-full">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-3 px-1 ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && <Icon className="w-4 h-4 mt-1 text-text-secondary shrink-0" strokeWidth={1.75} />}
        <div className="min-w-0">
          <h3 className="text-headline text-text-primary">{title}</h3>
          {description && (
            <p className="text-footnote text-text-secondary mt-0.5 max-w-xl">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, as: Elemento = 'div', padded = true, className = '', ...props }) {
  return (
    <Elemento
      className={`${CLASE_CARD} ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </Elemento>
  );
}

function CabeceraDialogo({ title, subtitle, headerAction, onClose, closeLabel, inline }) {
  if (!title && !subtitle && !headerAction && !onClose) return null;
  const etq = closeLabel || 'Cerrar';
  return (
    <div className={`${inline ? 'px-4 py-3.5' : 'px-6 pt-5 pb-4'} border-b border-separator flex items-start justify-between gap-3 shrink-0`}>
      <div className="min-w-0">
        {title && (
          inline
            ? <p className="text-body-emphasis text-text-primary">{title}</p>
            : <h2 className="text-title-2 text-text-primary tracking-tight">{title}</h2>
        )}
        {subtitle && <p className="text-small text-text-secondary mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {headerAction}
        {onClose && <IconButton icon={X} onClick={onClose} aria-label={etq} title={etq} />}
      </div>
    </div>
  );
}

export function DialogSheet({
  inline = false, title, subtitle, header, headerAction, footer,
  onClose, closeLabel, maxWidth = 'max-w-[540px]', bodyClassName = '', className = '', z = 'z-[150]', children
}) {
  if (inline) {
    return (
      <div className={`rounded-xl bg-surface border border-border/75 overflow-hidden shadow-xs ${className}`}>
        {header}
        <CabeceraDialogo inline title={title} subtitle={subtitle} headerAction={headerAction} onClose={onClose} closeLabel={closeLabel} />
        <div className={bodyClassName}>{children}</div>
        {footer && <div className="p-4 border-t border-separator bg-surface">{footer}</div>}
      </div>
    );
  }
  const fondoAttrs = onClose ? pulsable(onClose, closeLabel || 'Cerrar') : {};
  return (
    <div className={`fixed inset-0 ${z} flex items-end md:items-center justify-center md:p-6`}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" {...fondoAttrs} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative z-10 w-full ${maxWidth} bg-surface text-text-primary border border-border rounded-t-xl md:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[88vh] ${className}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>
        {header || <CabeceraDialogo title={title} subtitle={subtitle} headerAction={headerAction} onClose={onClose} closeLabel={closeLabel} />}
        <div className={`flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>{children}</div>
        {footer && <div className="p-4 md:px-6 border-t border-separator bg-surface shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
