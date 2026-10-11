import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Circle, Clock, XCircle } from 'lucide-react';

import Badge from '../ui/Badge.jsx';
import { MODE_SPECS } from '../../context/StudioContext.jsx';

const SEVERITY_TONE = { critical: 'danger', major: 'warn', minor: 'neutral' };

export default function TestPanel({ mode, report, running, onSelectFile }) {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const tests = useMemo(
    () => (report ? report.results : MODE_SPECS[mode].suite.tests.map((t) => ({ ...t, status: 'idle' }))),
    [report, mode],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return tests;
    return tests.filter((t) => t.status === filter);
  }, [tests, filter]);

  const counts = useMemo(
    () => ({
      all: tests.length,
      pass: tests.filter((t) => t.status === 'pass').length,
      fail: tests.filter((t) => t.status === 'fail').length,
      idle: tests.filter((t) => t.status === 'idle').length,
    }),
    [tests],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
        {['all', 'fail', 'pass', 'idle'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
              filter === key ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {key} <span className="tabular-nums opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {filtered.map((test) => (
          <TestRow
            key={test.id}
            test={test}
            open={openId === test.id}
            onToggle={() => setOpenId(openId === test.id ? null : test.id)}
            onSelectFile={onSelectFile}
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-[12px] text-ink-faint">
            No assertions in this state.
          </li>
        )}
      </ul>

      {report && <ScoreFooter report={report} running={running} />}
    </div>
  );
}

function TestRow({ test, open, onToggle, onSelectFile }) {
  const Icon =
    test.status === 'pass' ? CheckCircle2 : test.status === 'fail' ? XCircle : Circle;

  const iconColor =
    test.status === 'pass'
      ? 'text-emerald-400'
      : test.status === 'fail'
        ? 'text-rose-400'
        : 'text-ink-faint/50';

  return (
    <li className="border-b border-line-soft">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
          open ? 'bg-surface-2' : ''
        }`}
      >
        <Icon size={14} className={`mt-[2px] shrink-0 ${iconColor}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] text-ink-faint">{test.id}</span>
            {test.severity && (
              <Badge tone={SEVERITY_TONE[test.severity]} className="!px-1.5 !py-0 !text-[9px]">
                {test.severity}
              </Badge>
            )}
            {typeof test.duration === 'number' && (
              <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-ink-faint">
                <Clock size={9} />
                {test.duration}ms
              </span>
            )}
          </span>
          <span
            className={`mt-0.5 block text-[12.5px] leading-snug ${
              test.status === 'fail' ? 'text-rose-200' : 'text-ink-dim'
            }`}
          >
            {test.title}
          </span>
          {test.file && (
            <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-faint/80">
              {test.file}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-line-soft bg-canvas/60 px-3 py-2.5">
          {test.message && (
            <p className="font-mono text-[11.5px] leading-relaxed text-rose-300">{test.message}</p>
          )}

          {test.stack && (
            <pre className="overflow-x-auto rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ink-faint scroll-thin">
              {test.stack}
            </pre>
          )}

          {(test.expected !== undefined || test.actual !== undefined) && (
            <div className="grid grid-cols-2 gap-2 font-mono text-[10.5px]">
              <div className="rounded border border-line bg-surface px-2 py-1.5">
                <div className="text-ink-faint">expected</div>
                <div className="truncate text-emerald-300">{JSON.stringify(test.expected)}</div>
              </div>
              <div className="rounded border border-line bg-surface px-2 py-1.5">
                <div className="text-ink-faint">received</div>
                <div className="truncate text-rose-300">{JSON.stringify(test.actual)}</div>
              </div>
            </div>
          )}

          {test.logs?.length > 0 && (
            <div className="rounded border border-line bg-surface px-2 py-1.5">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
                console output
              </div>
              {test.logs.map((entry, i) => (
                <div
                  key={i}
                  className={`font-mono text-[10.5px] ${
                    entry.level === 'error' ? 'text-rose-300' : 'text-ink-faint'
                  }`}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {test.hint && (
              <p className="flex-1 text-[11.5px] leading-relaxed text-amber-200/80">
                <AlertCircle size={11} className="mr-1 inline align-[-1px]" />
                {test.hint}
              </p>
            )}
            {test.file && onSelectFile && (
              <button
                type="button"
                onClick={() => onSelectFile(test.file)}
                className="shrink-0 rounded-md border border-line px-2 py-1 text-[10.5px] text-ink-dim transition-colors hover:border-sky-500/50 hover:text-sky-300"
              >
                Open file
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function ScoreFooter({ report, running }) {
  const tone =
    report.score >= 85 ? 'ok' : report.score >= 60 ? 'warn' : 'danger';
  const toneText = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    danger: 'text-rose-400',
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface-2/70 px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          {running ? 'Running…' : 'Score'}
        </span>
        <span className={`font-mono text-lg font-semibold tabular-nums ${toneText[tone]}`}>
          {report.score}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-rose-500'
          }`}
          style={{ width: `${report.score}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-ink-faint">
        <span>
          {report.passed}/{report.total} assertions
        </span>
        <span className="tabular-nums">{(report.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
