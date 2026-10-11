const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 select-none';

const VARIANTS = {
  primary:
    'bg-sky-500 text-slate-950 hover:bg-sky-400 active:bg-sky-600 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset]',
  success:
    'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 font-semibold',
  ghost: 'bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink border border-line',
  subtle: 'bg-transparent text-ink-dim hover:text-ink hover:bg-surface-2',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25',
  outline: 'border border-line bg-transparent text-ink-dim hover:border-sky-500/60 hover:text-sky-300',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-[11px]',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9.5 px-4 text-[13px]',
  lg: 'h-11 px-5 text-sm',
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant] ?? VARIANTS.ghost} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
