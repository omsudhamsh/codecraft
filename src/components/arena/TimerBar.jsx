import { Clock, Pause, Play, RotateCcw, TimerOff } from 'lucide-react';

/**
 * The clock is opt-in. Untimed practice is the default: you can work the repository for
 * as long as you like and start the countdown whenever you want a pressure rehearsal.
 */
export default function TimerBar({ mode, session, onPause, onResume, onReset, onStart, onSubmit }) {
  const totalMs = (mode === 'A' ? 45 : 60) * 60 * 1000;
  const remaining = session.remainingMs ?? totalMs;
  const fraction = Math.max(0, Math.min(1, remaining / totalMs));

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const idle = session.status === 'idle';
  const running = session.status === 'active';
  const urgent = running && remaining <= 5 * 60 * 1000;
  const expired = session.status === 'expired';

  const barColor = idle
    ? 'bg-surface-3'
    : expired
      ? 'bg-rose-500'
      : urgent
        ? 'bg-gradient-to-r from-amber-500 to-rose-400'
        : fraction > 0.5
          ? 'bg-gradient-to-r from-sky-500 to-cyan-400'
          : 'bg-gradient-to-r from-amber-500 to-orange-400';

  const label = {
    idle: 'Untimed practice',
    active: 'Counting down',
    paused: 'Paused',
    submitted: 'Submitted',
    expired: 'Time expired — still editable',
  }[session.status];

  return (
    <div className="flex h-12 shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-3">
      <div
        className={`flex items-center gap-2 font-mono text-[15px] font-semibold tabular-nums ${
          idle ? 'text-ink-faint' : expired ? 'text-rose-400' : urgent ? 'text-amber-400' : 'text-ink'
        }`}
      >
        {idle ? <TimerOff size={14} className="opacity-70" /> : <Clock size={14} className="opacity-70" />}
        {idle ? '—:—' : display}
      </div>

      <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
          style={{ width: idle ? '100%' : `${fraction * 100}%` }}
        />
      </div>

      <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">{label}</span>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {idle && (
          <button
            type="button"
            onClick={onStart}
            title={`Start the ${mode === 'A' ? 45 : 60}-minute countdown`}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11.5px] text-ink-dim transition-colors hover:border-sky-500/50 hover:text-sky-300"
          >
            <Play size={12} />
            Start timer
          </button>
        )}
        {running && (
          <button
            type="button"
            onClick={onPause}
            title="Pause the countdown"
            className="rounded-md border border-line p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Pause size={13} />
          </button>
        )}
        {session.status === 'paused' && (
          <button
            type="button"
            onClick={onResume}
            title="Resume the countdown"
            className="rounded-md border border-line p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Play size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          title="Reset this round"
          className="rounded-md border border-line p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <RotateCcw size={12} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={session.status === 'submitted'}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11.5px] font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === 'A' ? 'Run Test Cases' : 'Submit Solution'}
        </button>
      </div>
    </div>
  );
}
