export default function Stat({ label, value, hint, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'text-ink',
    ok: 'text-emerald-400',
    danger: 'text-rose-400',
    brand: 'text-sky-400',
    warn: 'text-amber-400',
    violet: 'text-violet-300',
  };

  return (
    <div className="panel flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
        {Icon && <Icon size={13} className="text-ink-faint" />}
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${tones[tone] ?? tones.neutral}`}>{value}</div>
      {hint && <div className="text-[11.5px] text-ink-faint">{hint}</div>}
    </div>
  );
}
