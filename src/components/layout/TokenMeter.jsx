import { useMemo, useState } from 'react';
import { AlertTriangle, Cpu, RotateCcw, Zap } from 'lucide-react';

import { formatTokens, formatTokensLong, pct } from '../../lib/tokens.js';
import { useStudio } from '../../context/StudioContext.jsx';

export default function TokenMeter({ onExhausted }) {
  const { budget, actions } = useStudio();
  const [open, setOpen] = useState(false);

  const percent = useMemo(() => pct(budget.used, budget.limit), [budget]);
  const remaining = Math.max(0, budget.limit - budget.used);
  const tone =
    percent >= 90 ? 'danger' : percent >= 65 ? 'warn' : 'brand';

  const barColors = {
    brand: 'from-sky-500 to-cyan-400',
    warn: 'from-amber-500 to-yellow-400',
    danger: 'from-rose-500 to-red-400',
  };

  const toneText = {
    brand: 'text-sky-400',
    warn: 'text-amber-400',
    danger: 'text-rose-400',
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-line-soft hover:bg-surface-3"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${barColors[tone]} text-slate-950`}>
          <Cpu size={14} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
              AI token budget
            </span>
            <span className={`font-mono text-[11px] tabular-nums ${toneText[tone]}`}>
              {formatTokens(budget.used)} / {formatTokens(budget.limit)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barColors[tone]} transition-[width] duration-500`}
              style={{ width: `${Math.max(1.5, percent)}%` }}
            />
          </div>
        </div>

        {budget.locked && <AlertTriangle size={14} className="shrink-0 text-rose-400" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="panel absolute right-0 top-[calc(100%+8px)] z-20 w-80 bg-surface p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-ink">Copilot budget</h3>
              <span className={`font-mono text-[11px] ${toneText[tone]}`}>{percent.toFixed(1)}% used</span>
            </div>

            <dl className="mt-3 space-y-1.5 text-[12px]">
              <Row label="Consumed" value={`${formatTokensLong(budget.used)} tokens`} />
              <Row label="Remaining" value={`${formatTokensLong(remaining)} tokens`} />
              <Row label="Turns" value={String(budget.turns.length)} />
              <Row label="Average / turn" value={`${formatTokensLong(budget.turns.length ? Math.round(budget.used / budget.turns.length) : 0)} tokens`} />
            </dl>

            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
                <Zap size={11} /> Last turns
              </div>
              <ul className="max-h-44 space-y-1.5 overflow-y-auto scroll-thin">
                {budget.turns.length === 0 && (
                  <li className="text-[11.5px] text-ink-faint">No prompts sent yet.</li>
                )}
                {budget.turns
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((turn) => (
                    <li key={turn.id} className="flex items-start justify-between gap-3 text-[11.5px]">
                      <span className="min-w-0 flex-1 truncate text-ink-dim" title={turn.prompt}>
                        <span className="mr-1.5 font-mono text-[10px] text-ink-faint">[{turn.mode}]</span>
                        {turn.prompt}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-amber-300">
                        −{formatTokens(turn.cost.total)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Reset the AI token budget to ${formatTokensLong(budget.limit)} tokens?`)) {
                    actions.resetBudget();
                    setOpen(false);
                  }
                }}
                disabled={budget.used === 0}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11px] text-ink-dim transition-colors hover:border-sky-500/40 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RotateCcw size={11} />
                Reset token budget
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.resetBudget();
                  setOpen(false);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11px] text-ink-dim transition-colors hover:border-rose-500/40 hover:text-rose-300"
              >
                Reset everything
              </button>
            </div>

            {budget.locked && (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11.5px] text-rose-200">
                Budget exhausted — the assistant is locked for the rest of the session.
                <button type="button" className="ml-1 underline" onClick={() => onExhausted?.()}>
                  Why?
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-mono tabular-nums text-ink-dim">{value}</dd>
    </div>
  );
}
