import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Code2, Cpu, Layers, Lock, Timer, Zap } from 'lucide-react';

import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import { useStudio } from '../../context/StudioContext.jsx';
import { STACKS, findStack } from '../../data/stacks.js';

const ROUNDS = [
  {
    key: 'A',
    label: 'AI-Assisted Debugging',
    detail: 'Vinyl — deleting a track fails',
    accent: 'text-rose-300',
    ring: 'border-rose-500/30',
  },
  {
    key: 'B',
    label: 'AI-Assisted Feature Development',
    detail: 'CineVault — the awards section is mock data',
    accent: 'text-emerald-300',
    ring: 'border-emerald-500/30',
  },
];

/**
 * Mirrors the real assessment flow: pick a framework, pick a round, decide whether you
 * want the clock running. Nothing starts until you press Begin.
 */
export default function StartTestModal({ open, onClose, presetMode, onBegin }) {
  const navigate = useNavigate();
  const { modes, actions } = useStudio();

  const [stack, setStack] = useState('react-node');
  const [round, setRound] = useState(presetMode ?? 'A');
  const [timed, setTimed] = useState(false);

  const selected = findStack(stack);
  const blocked = !selected.runnable;

  const begin = () => {
    actions.startSession(round, { stack: selected.id, timed });
    onBegin?.();
    onClose();
    navigate(`/arena/${round}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a mock test"
      subtitle="Choose your framework before the round begins — the same choice the live assessment asks for."
      icon={Layers}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="success" onClick={begin} disabled={blocked}>
            {timed ? `Begin · ${modes[round].durationMinutes}:00 on the clock` : 'Begin untimed'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <SectionLabel icon={Code2} step={1} title="Framework / stack" />
          <div className="grid gap-2">
            {STACKS.map((option) => {
              const isSelected = option.id === stack;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStack(option.id)}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-sky-500/50 bg-sky-500/[0.07]'
                      : 'border-line bg-surface-2/40 hover:border-line-soft hover:bg-surface-2'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? 'border-sky-400 bg-sky-400 text-slate-950' : 'border-line'
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-ink">{option.label}</span>
                      {option.default && <Badge tone="brand">recommended</Badge>}
                      {!option.runnable && <Badge tone="neutral">assessment only</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-faint">{option.detail}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {option.languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint"
                        >
                          {lang}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {blocked && (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-2.5 text-[11.5px] leading-relaxed text-amber-100/90">
              <Lock size={13} className="mt-0.5 shrink-0" />
              <span>
                This practice build executes JavaScript in the browser, so only the JavaScript
                profiles can run the suite. <strong className="text-amber-200">React + Node.js</strong>{' '}
                reproduces the JavaScript round faithfully — pick it to continue.
              </span>
            </p>
          )}
        </section>

        <section>
          <SectionLabel icon={Cpu} step={2} title="Round" />
          <div className="grid gap-2 sm:grid-cols-2">
            {ROUNDS.map((option) => {
              const isSelected = option.key === round;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRound(option.key)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? `${option.ring} bg-surface-2`
                      : 'border-line bg-surface-2/40 hover:border-line-soft'
                  }`}
                >
                  <span className={`block text-[12.5px] font-medium ${option.accent}`}>{option.label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-faint">{option.detail}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionLabel icon={Timer} step={3} title="Clock" />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTimed(false)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                !timed ? 'border-sky-500/50 bg-sky-500/[0.07]' : 'border-line bg-surface-2/40'
              }`}
            >
              <span className="block text-[12.5px] font-medium text-ink">Untimed</span>
              <span className="mt-0.5 block text-[11px] text-ink-faint">Learn at your own pace</span>
            </button>
            <button
              type="button"
              onClick={() => setTimed(true)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                timed ? 'border-sky-500/50 bg-sky-500/[0.07]' : 'border-line bg-surface-2/40'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                <Zap size={12} className="text-amber-400" />
                Timed · {modes[round].durationMinutes}:00
              </span>
              <span className="mt-0.5 block text-[11px] text-ink-faint">Pressure rehearsal</span>
            </button>
          </div>
        </section>

        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
          The AI Assistant stays in tutor mode throughout: it points at files and explains concepts,
          and it will not implement the fix. The shared 200,000-token budget is not reset by starting
          a new round — use <span className="text-ink-dim">Reset token budget</span> on the dashboard
          if you want a clean slate.
        </p>
      </div>
    </Modal>
  );
}

function SectionLabel({ icon: Icon, step, title }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
      <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 font-mono text-[9.5px] text-ink-dim">
        {step}
      </span>
      <Icon size={12} />
      {title}
    </h3>
  );
}
