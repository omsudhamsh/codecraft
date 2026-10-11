import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  FileCode2,
  Flame,
  Gauge,
  HelpCircle,
  Lightbulb,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Wrench,
  Swords,
} from 'lucide-react';

import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Stat from '../components/ui/Stat.jsx';
import StartTestModal from '../components/start/StartTestModal.jsx';
import { useStudio } from '../context/StudioContext.jsx';
import { formatTokensLong, pct, TOTAL_BUDGET } from '../lib/tokens.js';
import { questionsFor } from '../data/questions.js';

const MODE_META = {
  A: {
    icon: Wrench,
    ring: 'border-rose-500/30',
    titleColor: 'text-rose-300',
    kind: 'Round 1',
    verb: 'Fix the bugs',
  },
  B: {
    icon: Swords,
    ring: 'border-emerald-500/30',
    titleColor: 'text-emerald-300',
    kind: 'Round 2',
    verb: 'Build the feature',
  },
};

export default function DashboardView({ onExhausted }) {
  const { sessions, progress, budget, modes, actions } = useStudio();
  const [starting, setStarting] = useState(false);

  const overall = useMemo(() => {
    const a = progress.bestScore.A ?? 0;
    const b = progress.bestScore.B ?? 0;
    return Math.round((a + b) / 2);
  }, [progress.bestScore]);

  const attempts = (progress.attempts.A ?? 0) + (progress.attempts.B ?? 0);
  const budgetPct = pct(budget.used, budget.limit);
  const questionCount = questionsFor('A').length + questionsFor('B').length;

  return (
    <div className="mx-auto h-full w-full max-w-6xl space-y-6 overflow-y-auto px-4 py-6 scroll-thin">
      <header className="panel p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Capgemini Exceller · Round 2</Badge>
          <Badge tone="violet">13–16 LPA</Badge>
          <Badge tone="neutral">AI-Assisted Full-Stack</Badge>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">
          Two rounds, one 200,000 token budget.
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-dim">
          Fix a broken music-streaming service, then replace a movie platform&apos;s mock awards
          section with real data and a permission layer. Six graded assertions per round, a
          tutor-mode assistant that points at files but will not write the fix, and a clock you can
          start whenever you want.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="lg" onClick={() => setStarting(true)}>
            <PlayCircle size={16} />
            Start a mock test
          </Button>
          <Link to="/questions">
            <Button size="lg">
              <Shuffle size={15} />
              {questionCount} questions
            </Button>
          </Link>
          <Link to="/analytics">
            <Button size="lg">
              <Gauge size={15} />
              Analytics
            </Button>
          </Link>
        </div>
      </header>

      <StartTestModal open={starting} onClose={() => setStarting(false)} />

      {/* exam controls */}
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Cpu size={14} className="text-amber-400" />
            Exam controls
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">
            Reset the Copilot budget to a full {formatTokensLong(TOTAL_BUDGET)} tokens before you start a
            round. Your scores, files and history are untouched.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(`Reset the AI token budget to ${formatTokensLong(TOTAL_BUDGET)} tokens?`)) {
                actions.resetBudget();
              }
            }}
            disabled={budget.used === 0}
            title={budget.used === 0 ? 'The budget is already full' : 'Restore the full 200,000 tokens'}
          >
            <RotateCcw size={14} />
            Reset token budget
          </Button>
          <Button onClick={onExhausted}>How the budget works</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Best average"
          value={attempts > 0 ? `${overall}%` : '—'}
          hint={attempts > 0 ? 'mean of your best per round' : 'no runs yet'}
          tone={attempts === 0 ? 'neutral' : overall >= 100 ? 'ok' : overall >= 50 ? 'warn' : 'danger'}
          icon={Trophy}
        />
        <Stat
          label="Suite runs"
          value={String(progress.totalRuns)}
          hint={`${progress.attempts.A ?? 0} debugging · ${progress.attempts.B ?? 0} feature`}
          icon={Flame}
        />
        <Stat
          label="Tokens spent"
          value={formatTokensLong(budget.used)}
          hint={`${budgetPct.toFixed(0)}% of ${formatTokensLong(budget.limit)}`}
          tone={budgetPct > 80 ? 'danger' : 'brand'}
          icon={Cpu}
        />
        <Stat
          label="Assistant turns"
          value={String(budget.turns.length)}
          hint={budget.resets ? `budget reset ${budget.resets}×` : 'budget untouched'}
          tone="violet"
          icon={Sparkles}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {['A', 'B'].map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            spec={modes[mode]}
            session={sessions[mode]}
            score={progress.bestScore[mode]}
            attempts={progress.attempts[mode] ?? 0}
            questionCount={questionsFor(mode).length}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <ShieldCheck size={14} className="text-sky-400" />
            How each round is graded
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Point
              icon={Target}
              title="Six assertions per round"
              body="Each maps to a rule a reviewer would actually enforce — error propagation, header casing, effect dependencies, server-side scoping."
            />
            <Point
              icon={FileCode2}
              title="Your code runs for real"
              body="Runtime checks execute your modules. Integration checks boot your Express app and issue actual HTTP requests."
            />
            <Point
              icon={Lightbulb}
              title="The assistant tutors, it does not solve"
              body="Ask it which files have errors and it gives you clickable paths. Ask it to fix them and it declines, then teaches the concept."
            />
            <Point
              icon={HelpCircle}
              title="The clock is optional"
              body="Practice untimed by default. Start the countdown whenever you want a pressure rehearsal — it never starts on its own."
            />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Cpu size={14} className="text-amber-400" />
            Budget ledger
          </h2>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                budgetPct > 80
                  ? 'bg-gradient-to-r from-rose-500 to-red-400'
                  : 'bg-gradient-to-r from-amber-500 to-sky-400'
              }`}
              style={{ width: `${Math.max(1, budgetPct)}%` }}
            />
          </div>
          <dl className="mt-3 space-y-1.5 text-[12px]">
            <Line label="Remaining" value={`${formatTokensLong(budget.limit - budget.used)} tokens`} />
            <Line label="Turns used" value={String(budget.turns.length)} />
            <Line
              label="Costliest turn"
              value={
                budget.turns.length
                  ? `${formatTokensLong(Math.max(...budget.turns.map((t) => t.cost.total)))} tokens`
                  : '—'
              }
            />
          </dl>
          <button
            type="button"
            onClick={onExhausted}
            className="mt-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-dim transition-colors hover:border-rose-500/40 hover:text-rose-300"
          >
            What happens at zero
          </button>
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function ModeCard({ mode, spec, session, score, attempts, questionCount }) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const live = session.status === 'active' || session.status === 'paused';
  const done = session.status === 'submitted';

  return (
    <Card className={`relative overflow-hidden border ${meta.ring} p-5`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.ring} bg-surface-2`}>
          <Icon size={18} className={meta.titleColor} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
              {meta.kind}
            </span>
            {live && <Badge tone="brand">counting down</Badge>}
            {done && <Badge tone="ok">submitted</Badge>}
            {!live && !done && <Badge tone="neutral">untimed</Badge>}
          </div>
          <h2 className={`mt-0.5 text-[15px] font-semibold ${meta.titleColor}`}>{meta.verb}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{spec.repoName}</p>
        </div>
        <div className="text-right">
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${
              score == null
                ? 'text-ink-faint'
                : score === 100
                  ? 'text-emerald-400'
                  : score >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
            }`}
          >
            {score == null ? '—' : `${score}%`}
          </div>
          <div className="text-[10.5px] text-ink-faint">best of {attempts}</div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-dim">{spec.objective}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">6 assertions</Badge>
        <Badge tone="neutral">{questionCount} questions</Badge>
        <Badge tone="neutral">timer optional</Badge>
        {spec.stack.slice(0, 2).map((tech) => (
          <Badge key={tech} tone="neutral">{tech}</Badge>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Link to={`/arena/${mode}`} className="flex-1">
          <Button variant={live || done ? 'ghost' : 'primary'} size="sm" className="w-full">
            Open round
          </Button>
        </Link>
        <Link to="/questions" className="flex-1">
          <Button size="sm" className="w-full">
            <Shuffle size={12} />
            Questions
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function Point({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-sky-400" />
        <span className="text-[12.5px] font-medium text-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{body}</p>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-mono tabular-nums text-ink-dim">{value}</dd>
    </div>
  );
}
