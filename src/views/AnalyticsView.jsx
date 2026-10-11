import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Cpu,
  Download,
  Flame,
  Target,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react';

import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Stat from '../components/ui/Stat.jsx';
import Button from '../components/ui/Button.jsx';
import { useStudio } from '../context/StudioContext.jsx';
import { MODE_A_SUITE } from '../data/modeA/tests.js';
import { MODE_B_SUITE } from '../data/modeB/tests.js';
import { formatTokensLong } from '../lib/tokens.js';

const SUITES = { A: MODE_A_SUITE, B: MODE_B_SUITE };

export default function AnalyticsView() {
  const { progress, budget, sessions } = useStudio();

  const stats = useMemo(() => {
    const runs = progress.runs;
    if (runs.length === 0) {
      return { avg: null, best: null, total: 0, trend: [], improvement: null };
    }
    const scores = runs.map((r) => r.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = Math.max(...scores);

    const firstHalf = runs.slice(0, Math.ceil(runs.length / 2));
    const secondHalf = runs.slice(Math.ceil(runs.length / 2));
    const mean = (list) =>
      list.length === 0 ? 0 : list.reduce((a, r) => a + r.score, 0) / list.length;
    const improvement =
      firstHalf.length && secondHalf.length
        ? Math.round(mean(secondHalf) - mean(firstHalf))
        : null;

    return { avg, best, total: runs.length, trend: runs.slice(-14), improvement };
  }, [progress.runs]);

  const perMode = useMemo(
    () =>
      ['A', 'B'].map((mode) => {
        const runs = progress.runs.filter((r) => r.mode === mode);
        const scores = runs.map((r) => r.score);
        return {
          mode,
          runs,
          count: runs.length,
          avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          best: scores.length ? Math.max(...scores) : null,
          last: scores.at(-1) ?? null,
        };
      }),
    [progress.runs],
  );

  const mastery = useMemo(() => {
    const out = {};
    for (const mode of ['A', 'B']) {
      const runs = progress.runs.filter((r) => r.mode === mode);
      const tests = SUITES[mode].tests;
      out[mode] = tests.map((test) => {
        // A test is "mastered" once it no longer appears in any recent failing list.
        const failingIn = runs.filter((r) => r.failing.includes(test.id)).length;
        const everPassed = failingIn < runs.length;
        return { ...test, failingIn, status: runs.length === 0 ? 'unknown' : everPassed ? 'pass' : 'fail' };
      });
    }
    return out;
  }, [progress.runs]);

  const exportJson = () => {
    const payload = { progress, budget: { ...budget, turns: budget.turns }, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capex-ai-studio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = progress.runs.length > 0;

  return (
    <div className="mx-auto h-full w-full max-w-6xl space-y-6 overflow-y-auto px-4 py-6 scroll-thin">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
            <BarChart3 size={19} className="text-sky-400" />
            Analytics
          </h1>
          <p className="mt-1 text-[13px] text-ink-dim">
            Every run is recorded locally in your browser. Nothing leaves this machine.
          </p>
        </div>
        <Button size="sm" onClick={exportJson} disabled={!hasData}>
          <Download size={13} />
          Export JSON
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Runs recorded"
          value={String(stats.total)}
          hint={stats.total ? `latest ${progress.runs.at(-1)?.score ?? 0}%` : 'run a suite to begin'}
          icon={Activity}
        />
        <Stat
          label="Mean score"
          value={stats.avg == null ? '—' : `${stats.avg}%`}
          hint={stats.best == null ? '' : `best ${stats.best}%`}
          tone={stats.avg == null ? 'neutral' : stats.avg >= 85 ? 'ok' : stats.avg >= 60 ? 'warn' : 'danger'}
          icon={Target}
        />
        <Stat
          label="Trajectory"
          value={stats.improvement == null ? '—' : `${stats.improvement > 0 ? '+' : ''}${stats.improvement}`}
          hint="second half vs first half"
          tone={stats.improvement > 0 ? 'ok' : stats.improvement < 0 ? 'danger' : 'neutral'}
          icon={TrendingUp}
        />
        <Stat
          label="Tokens spent"
          value={formatTokensLong(budget.used)}
          hint={`${budget.turns.length} copilot turns`}
          tone="brand"
          icon={Cpu}
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Activity size={14} className="text-sky-400" />
            Score trend
          </h2>
          {!hasData ? (
            <EmptyState message="No runs yet — enter a round and press Run Test Cases." />
          ) : (
            <>
              <div className="mt-4 flex h-40 items-end gap-1.5">
                {stats.trend.map((run, i) => {
                  const height = Math.max(4, (run.score / 100) * 100);
                  const tone =
                    run.score >= 85 ? 'bg-emerald-500' : run.score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
                  return (
                    <div key={run.id + i} className="group relative flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${tone} opacity-80 transition-opacity group-hover:opacity-100`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="font-mono text-[9px] text-ink-faint">{run.mode}</span>
                      <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] text-ink shadow-xl group-hover:block">
                        {run.score}% · {run.passed}/{run.total} · {new Date(run.at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-[10.5px] text-ink-faint">
                <span>oldest</span>
                <span>most recent</span>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Trophy size={14} className="text-amber-400" />
            Per round
          </h2>
          <div className="mt-3 space-y-3">
            {perMode.map((row) => (
              <div key={row.mode} className="rounded-xl border border-line bg-surface-2/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-ink">
                    {row.mode === 'A' ? 'Round 1 · Debugging' : 'Round 2 · Feature'}
                  </span>
                  <span
                    className={`font-mono text-[15px] font-semibold tabular-nums ${
                      row.best == null ? 'text-ink-faint' : row.best >= 85 ? 'text-emerald-400' : row.best >= 60 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {row.best == null ? '—' : `${row.best}%`}
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-[11.5px]">
                  <Line label="Runs" value={String(row.count)} />
                  <Line label="Mean" value={row.avg == null ? '—' : `${row.avg}%`} />
                  <Line label="Latest" value={row.last == null ? '—' : `${row.last}%`} />
                </dl>
                <Link to={`/arena/${row.mode}`} className="mt-2.5 block">
                  <Button size="xs" className="w-full">
                    Open round {row.mode}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {['A', 'B'].map((mode) => (
          <Card key={mode} className="p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Flame size={14} className={mode === 'A' ? 'text-rose-400' : 'text-emerald-400'} />
              {mode === 'A' ? 'Debugging' : 'Feature'} · assertion mastery
            </h2>
            <p className="mt-1 text-[11.5px] text-ink-faint">
              {sessions[mode].report
                ? `Based on your latest run in round ${mode}.`
                : `No run recorded for round ${mode} yet.`}
            </p>
            <ul className="mt-3 space-y-1">
              {mastery[mode].map((test) => (
                <li
                  key={test.id}
                  className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-2/40 px-2.5 py-1.5"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      test.status === 'pass'
                        ? 'bg-emerald-400'
                        : test.status === 'fail'
                          ? 'bg-rose-400'
                          : 'bg-ink-faint/40'
                    }`}
                  />
                  <span className="font-mono text-[10px] text-ink-faint">{test.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-dim">{test.title}</span>
                  {test.failingIn > 0 && (
                    <Badge tone="danger" className="!text-[9px]">
                      {test.failingIn}×
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Timer size={14} className="text-violet-300" />
          Run history
        </h2>
        {!hasData ? (
          <EmptyState message="Nothing recorded yet." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[11.5px]">
              <thead>
                <tr className="text-ink-faint">
                  <th className="border-b border-line px-2 py-2 text-left font-medium">When</th>
                  <th className="border-b border-line px-2 py-2 text-left font-medium">Round</th>
                  <th className="border-b border-line px-2 py-2 text-left font-medium">Score</th>
                  <th className="border-b border-line px-2 py-2 text-left font-medium">Passed</th>
                  <th className="border-b border-line px-2 py-2 text-left font-medium">Suite time</th>
                  <th className="border-b border-line px-2 py-2 text-left font-medium">Failing assertions</th>
                </tr>
              </thead>
              <tbody>
                {progress.runs
                  .slice()
                  .reverse()
                  .map((run) => (
                    <tr key={run.id} className="odd:bg-surface/40">
                      <td className="border-b border-line-soft px-2 py-1.5 text-ink-faint">
                        {new Date(run.at).toLocaleString()}
                      </td>
                      <td className="border-b border-line-soft px-2 py-1.5 font-mono text-sky-400">
                        {run.mode}
                      </td>
                      <td className="border-b border-line-soft px-2 py-1.5">
                        <span
                          className={`font-mono tabular-nums ${
                            run.score >= 85 ? 'text-emerald-400' : run.score >= 60 ? 'text-amber-400' : 'text-rose-400'
                          }`}
                        >
                          {run.score}%
                        </span>
                      </td>
                      <td className="border-b border-line-soft px-2 py-1.5 font-mono tabular-nums text-ink-dim">
                        {run.passed}/{run.total}
                      </td>
                      <td className="border-b border-line-soft px-2 py-1.5 font-mono tabular-nums text-ink-faint">
                        {(run.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="border-b border-line-soft px-2 py-1.5 font-mono text-[10.5px] text-ink-faint">
                        {run.failing.length ? run.failing.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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

function EmptyState({ message }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-10 text-center text-[12.5px] text-ink-faint">
      {message}
    </div>
  );
}
