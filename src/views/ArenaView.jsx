import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  FlaskConical,
  Lightbulb,
  PanelRightClose,
  Sparkles,
  Target,
  Terminal,
  Trophy,
  X,
} from 'lucide-react';

import TimerBar from '../components/arena/TimerBar.jsx';
import FileExplorer from '../components/arena/FileExplorer.jsx';
import CodeEditor from '../components/arena/CodeEditor.jsx';
import TestPanel from '../components/arena/TestPanel.jsx';
import RunConsole from '../components/arena/RunConsole.jsx';
import TaskPanel from '../components/arena/TaskPanel.jsx';
import CopilotPanel from '../components/copilot/CopilotPanel.jsx';
import TokenExhaustedModal from '../components/common/TokenExhaustedModal.jsx';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import { useStudio } from '../context/StudioContext.jsx';
import { findQuestion } from '../data/questions.js';

const RAIL_TABS = [
  { key: 'copilot', label: 'Assistant', icon: Sparkles },
  { key: 'tests', label: 'Tests', icon: FlaskConical },
  { key: 'console', label: 'Console', icon: Terminal },
  { key: 'brief', label: 'Brief', icon: BookOpen },
];

export default function ArenaView({ onExhausted }) {
  const { mode: rawMode } = useParams();
  const mode = rawMode === 'B' ? 'B' : 'A';
  const navigate = useNavigate();

  const { modes, sessions, budget, actions } = useStudio();
  const spec = modes[mode];
  const session = sessions[mode];

  const [tab, setTab] = useState('copilot');
  const [railOpen, setRailOpen] = useState(true);
  const [showExhausted, setShowExhausted] = useState(false);
  const [reportModal, setReportModal] = useState(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [hints, setHints] = useState(0);

  const readOnly = session.status === 'submitted';
  const question = session.questionId ? findQuestion(mode, session.questionId) : null;

  useEffect(() => {
    setTab('copilot');
    setRailOpen(true);
    setHints(0);
  }, [mode]);

  const runSuite = useCallback(async () => {
    const result = await actions.runTests(mode);
    if (result) {
      setTab('tests');
      setRailOpen(true);
      setReportModal(result);
    }
  }, [actions, mode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runSuite();
      }
      if (e.key === '?') setShortcuts(true);
      if (e.key === 'Escape') setShortcuts(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runSuite]);

  const activePath = session.activeFile ?? Object.keys(session.files)[0];
  const content = session.files[activePath] ?? '';
  const dirty = Boolean(session.dirty[activePath]);
  const isNew = session.baselineFiles[activePath] === undefined;
  const report = session.report;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TimerBar
        mode={mode}
        session={session}
        onStart={() => actions.startSession(mode)}
        onPause={() => actions.pauseSession(mode)}
        onResume={() => actions.resumeSession(mode)}
        onReset={() => {
          if (window.confirm(`Reset ${spec.repoName}? Edits and results for this round are discarded.`)) {
            actions.resetSession(mode);
          }
        }}
        onSubmit={runSuite}
      />

      {question && (
        <QuestionBanner
          question={question}
          revealedHints={hints}
          onRevealHint={() => setHints((h) => h + 1)}
          onClear={() => {
            actions.setQuestion(mode, null);
            setHints(0);
          }}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-line md:block">
          <FileExplorer mode={mode} readOnly={readOnly} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
            <span className="truncate font-mono text-[11.5px] text-ink-dim">{activePath}</span>
            {isNew && <Badge tone="violet">new</Badge>}
            {dirty && !isNew && <Badge tone="warn">modified</Badge>}
            {readOnly && <Badge tone="danger">read only</Badge>}

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[10.5px] text-ink-faint sm:block">
                {content.split('\n').length} lines · Ctrl/⌘+Enter to run
              </span>
              <button
                type="button"
                onClick={() => setRailOpen((v) => !v)}
                title="Toggle assistant panel"
                className="rounded-md border border-line p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
              >
                {railOpen ? <PanelRightClose size={13} /> : <Sparkles size={13} />}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <CodeEditor
              path={activePath}
              value={content}
              readOnly={readOnly}
              onChange={(next) => actions.writeFile(mode, activePath, next)}
            />
          </div>
        </section>

        {railOpen && (
          <aside className="hidden w-[24rem] shrink-0 flex-col border-l border-line lg:flex xl:w-[26rem]">
            <RailTabs tab={tab} setTab={setTab} report={report} />
            <RailBody
              mode={mode}
              tab={tab}
              report={report}
              running={session.running}
              runLog={session.runLog}
              spec={spec}
              onSelectFile={(path) => actions.openFile(mode, path)}
              onExhausted={() => setShowExhausted(true)}
              onOpenQuestion={() => setTab('brief')}
            />
          </aside>
        )}
      </div>

      <div className="border-t border-line lg:hidden">
        <RailTabs tab={tab} setTab={setTab} report={report} />
        <div className="h-72 border-t border-line">
          <RailBody
            mode={mode}
            tab={tab}
            report={report}
            running={session.running}
            runLog={session.runLog}
            spec={spec}
            onSelectFile={(path) => actions.openFile(mode, path)}
            onExhausted={() => setShowExhausted(true)}
            onOpenQuestion={() => setTab('brief')}
          />
        </div>
      </div>

      <TokenExhaustedModal open={showExhausted} onClose={() => setShowExhausted(false)} budget={budget} />

      <Modal
        open={Boolean(reportModal)}
        onClose={() => setReportModal(null)}
        icon={reportModal?.score === 100 ? Trophy : FlaskConical}
        tone={reportModal?.score === 100 ? 'ok' : reportModal?.score >= 50 ? 'warn' : 'danger'}
        title={
          reportModal?.score === 100
            ? 'All six assertions pass'
            : reportModal?.failed === 1
              ? 'One assertion left'
              : `${reportModal?.failed ?? 0} assertions still failing`
        }
        subtitle={
          reportModal
            ? `${reportModal.passed}/${reportModal.total} · ${reportModal.pointsEarned}/${reportModal.totalPoints} points · ${(reportModal.durationMs / 1000).toFixed(1)}s`
            : ''
        }
        footer={
          <>
            <Button size="sm" onClick={() => setReportModal(null)}>
              Back to the editor
            </Button>
            <Button size="sm" variant="primary" onClick={() => { setReportModal(null); setTab('tests'); }}>
              Review failures
            </Button>
            <Button size="sm" variant="success" onClick={() => navigate('/analytics')}>
              Analytics
            </Button>
          </>
        }
      >
        {reportModal && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Score" value={`${reportModal.score}%`} />
              <Metric label="Passed" value={String(reportModal.passed)} tone="ok" />
              <Metric
                label="Failing"
                value={String(reportModal.failed)}
                tone={reportModal.failed ? 'danger' : 'ok'}
              />
            </div>

            {reportModal.failed > 0 && (
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Still failing
                </h4>
                <ul className="space-y-1.5">
                  {reportModal.results
                    .filter((r) => r.status === 'fail')
                    .map((r) => (
                      <li key={r.id} className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-rose-300">{r.id}</span>
                          <span className="text-[12px] text-ink">{r.title}</span>
                        </div>
                        {r.message && (
                          <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-rose-200/80">
                            {r.message.split('\n')[0]}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={shortcuts}
        onClose={() => setShortcuts(false)}
        title="Keyboard shortcuts"
        icon={X}
        footer={<Button size="sm" onClick={() => setShortcuts(false)}>Close</Button>}
      >
        <dl className="space-y-2 text-[12.5px]">
          <Shortcut keys="Ctrl / ⌘ + Enter" label="Run the test suite" />
          <Shortcut keys="Tab" label="Insert two spaces in the editor" />
          <Shortcut keys="Enter" label="Send an assistant prompt" />
          <Shortcut keys="Esc" label="Close a dialog" />
        </dl>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function RailTabs({ tab, setTab, report }) {
  return (
    <nav className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
      {RAIL_TABS.map((item) => {
        const Icon = item.icon;
        const active = tab === item.key;
        const badge = item.key === 'tests' && report ? `${report.passed}/${report.total}` : null;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium transition-colors ${
              active ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            <Icon size={12} />
            {item.label}
            {badge && <span className="font-mono text-[10px] tabular-nums text-sky-400">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function RailBody({ mode, tab, report, running, runLog, spec, onSelectFile, onExhausted, onOpenQuestion }) {
  if (tab === 'copilot')
    return (
      <CopilotPanel mode={mode} onExhausted={onExhausted} onOpenQuestion={onOpenQuestion} />
    );
  if (tab === 'tests')
    return (
      <div className="h-full">
        <TestPanel mode={mode} report={report} running={running} onSelectFile={onSelectFile} />
      </div>
    );
  if (tab === 'console')
    return (
      <div className="h-full">
        <RunConsole log={runLog ?? []} />
      </div>
    );
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <TaskPanel mode={mode} spec={spec} />
    </div>
  );
}

function QuestionBanner({ question, revealedHints, onRevealHint, onClear }) {
  const allRevealed = revealedHints >= question.hints.length;

  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <Target size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-amber-300">{question.id}</span>
            <span className="text-[13px] font-medium text-ink">{question.title}</span>
            <Badge tone={question.difficulty === 'Easy' ? 'ok' : 'warn'}>{question.difficulty}</Badge>
            <span className="text-[11px] text-ink-faint">≈ {question.minutes} min</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{question.prompt}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={allRevealed ? undefined : onRevealHint}
              disabled={allRevealed}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[10.5px] text-ink-faint transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
            >
              <Lightbulb size={11} />
              {allRevealed ? 'No more hints' : `Hint ${revealedHints + 1} of ${question.hints.length}`}
            </button>

            {question.hints.slice(0, revealedHints).map((hint, i) => (
              <span
                key={hint}
                className="rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1 text-[10.5px] text-amber-100/90"
              >
                {i + 1}. {hint}
              </span>
            ))}

            <button
              type="button"
              onClick={onClear}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] text-ink-faint transition-colors hover:text-ink-dim"
            >
              <X size={11} />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }) {
  const tones = { neutral: 'text-ink', ok: 'text-emerald-400', danger: 'text-rose-400' };
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  );
}

function Shortcut({ keys, label }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-dim">{label}</dt>
      <dd className="rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink">
        {keys}
      </dd>
    </div>
  );
}
