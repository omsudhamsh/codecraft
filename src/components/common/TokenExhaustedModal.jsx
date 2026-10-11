import { AlertOctagon, RotateCcw, TrendingDown } from 'lucide-react';

import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { formatTokensLong } from '../../lib/tokens.js';
import { useStudio } from '../../context/StudioContext.jsx';

export default function TokenExhaustedModal({ open, onClose, budget }) {
  const { actions } = useStudio();
  const lastTurns = budget.turns.slice(-5);

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable
      icon={AlertOctagon}
      tone="danger"
      title="Token Budget Exhausted!"
      subtitle="Task failed due to resource limits."
      footer={
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              actions.resetBudget();
              onClose();
            }}
          >
            <RotateCcw size={13} />
            Reset token budget
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Reset the token budget and all progress?')) actions.resetEverything();
              onClose();
            }}
          >
            Reset everything
          </Button>
          <Button size="sm" variant="danger" onClick={onClose}>
            Continue without the assistant
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-ink-dim">
          The AI Copilot consumed all{' '}
          <span className="font-mono text-ink">{formatTokensLong(budget.limit)}</span> tokens available to
          this session. In the live assessment this is a hard stop: the moment the budget reaches zero,
          the assistant is disabled and any task still relying on it cannot be completed.
        </p>

        <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3">
          <div className="flex items-center gap-2 text-[12px] font-medium text-rose-200">
            <TrendingDown size={13} />
            Where the budget went
          </div>
          <ul className="mt-2 space-y-1">
            {lastTurns.length === 0 && (
              <li className="font-mono text-[11px] text-ink-faint">No recorded turns.</li>
            )}
            {lastTurns.map((turn) => (
              <li key={turn.id} className="flex items-start justify-between gap-3 text-[11.5px]">
                <span className="min-w-0 flex-1 text-ink-dim">
                  <span className="mr-1.5 font-mono text-[10px] text-ink-faint">[{turn.mode}]</span>
                  <span className="line-clamp-1">{turn.prompt}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-amber-300">
                  {formatTokensLong(turn.cost.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] leading-relaxed text-ink-faint">
          <span className="font-medium text-ink-dim">How to avoid this:</span> ask about one file and
          one symptom, prefer a targeted follow-up over re-asking broadly, and request just the patch
          when you already understand the diagnosis. Reading the assertion before you prompt usually
          halves the number of turns you need.
        </p>
      </div>
    </Modal>
  );
}
