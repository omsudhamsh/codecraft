import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, subtitle, icon: Icon, tone = 'brand', children, footer, dismissable = true }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  const accents = {
    brand: 'text-sky-400 bg-sky-500/12 border-sky-500/30',
    danger: 'text-rose-400 bg-rose-500/12 border-rose-500/30',
    warn: 'text-amber-400 bg-amber-500/12 border-amber-500/30',
    ok: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/30',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="panel glow-brand relative w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl"
      >
        <div className="flex items-start gap-4 border-b border-line p-5">
          {Icon && (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accents[tone]}`}>
              <Icon size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{subtitle}</p>}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 scroll-thin">{children}</div>

        {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
