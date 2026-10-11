export default function Badge({ tone = 'neutral', className = '', children }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-dim border-line',
    brand: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
    ok: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
    danger: 'bg-rose-500/12 text-rose-300 border-rose-500/30',
    warn: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
    violet: 'bg-violet-500/12 text-violet-300 border-violet-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${tones[tone] ?? tones.neutral} ${className}`}
    >
      {children}
    </span>
  );
}
