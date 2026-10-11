import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock3,
  FileCode2,
  HelpCircle,
  Lightbulb,
  PlayCircle,
  Search,
  Shuffle,
  Swords,
  Timer,
  Wrench,
} from 'lucide-react';

import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import { useStudio } from '../context/StudioContext.jsx';
import { DEBUGGING_QUESTIONS, FEATURE_QUESTIONS, estimatedMinutes, questionsFor, randomQuestion } from '../data/questions.js';

const ROUNDS = {
  A: {
    key: 'A',
    label: 'AI Debugging',
    icon: Wrench,
    tone: 'text-rose-300',
    ring: 'border-rose-500/30',
    blurb: 'Vinyl — a music-streaming service where deleting a track fails.',
  },
  B: {
    key: 'B',
    label: 'AI Feature Development',
    icon: Swords,
    tone: 'text-emerald-300',
    ring: 'border-emerald-500/30',
    blurb: 'CineVault — a movie platform whose awards section runs on mock data.',
  },
};

export default function QuestionsView() {
  const navigate = useNavigate();
  const { sessions, actions } = useStudio();

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [picked, setPicked] = useState({ A: null, B: null });

  const matches = (question) => {
    if (difficulty !== 'all' && question.difficulty !== difficulty) return false;
    if (!query.trim()) return true;
    const haystack = `${question.id} ${question.title} ${question.prompt} ${question.tags.join(' ')}`;
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  };

  const open = (mode, question, { startTimer = false, stack = 'react-node' } = {}) => {
    actions.setQuestion(mode, question);
    actions.startSession(mode, { stack, timed: startTimer });
    navigate(`/arena/${mode}`);
  };

  const pickRandom = (mode) => {
    const current = picked[mode];
    const next = randomQuestion(mode, current?.id);
    setPicked((prev) => ({ ...prev, [mode]: next }));
  };

  return (
    <div className="mx-auto h-full w-full max-w-6xl space-y-6 overflow-y-auto px-4 py-6 scroll-thin">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
          <HelpCircle size={19} className="text-sky-400" />
          Question Bank
        </h1>
        <p className="mt-1 text-[13px] text-ink-dim">
          20 exercises drawn from the kinds of tasks the real assessment sets — 10 debugging on a
          music-streaming service, 10 feature development on a movie platform. Six of each map to a
          graded assertion, so the suite doubles as the answer key.
        </p>
      </header>

      {/* controls */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, tags, files…"
            className="w-full rounded-lg border border-line bg-canvas py-2 pl-8 pr-3 text-[12.5px] text-ink outline-none placeholder:text-ink-faint/70 focus:border-sky-500/50"
          />
        </div>

        <div className="flex gap-1">
          {['all', 'Easy', 'Moderate'].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              className={`rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                difficulty === level ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {level === 'all' ? 'All levels' : level}
            </button>
          ))}
        </div>
      </Card>

      {['A', 'B'].map((mode) => {
        const meta = ROUNDS[mode];
        const Icon = meta.icon;
        const all = questionsFor(mode);
        const list = all.filter(matches);
        const current = picked[mode];
        const activeQuestion = sessions[mode].questionId;

        return (
          <section key={mode} className="space-y-3">
            <header className="flex flex-wrap items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${meta.ring} bg-surface`}>
                <Icon size={16} className={meta.tone} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`text-[15px] font-semibold ${meta.tone}`}>
                  {meta.label}
                  <span className="ml-2 font-mono text-[12px] font-normal text-ink-faint">
                    {list.length}/{all.length} questions
                  </span>
                </h2>
                <p className="text-[12px] text-ink-faint">
                  {meta.blurb} · ≈ {estimatedMinutes(mode)} min for the full set
                </p>
              </div>

              <Button size="sm" onClick={() => pickRandom(mode)}>
                <Shuffle size={13} />
                Random {mode === 'A' ? 'debug' : 'feature'} question
              </Button>
            </header>

            {current && (
              <Card className={`border ${meta.ring} p-4`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warn">picked at random</Badge>
                      <span className="font-mono text-[11px] font-semibold text-amber-300">{current.id}</span>
                      <span className="text-[13px] font-medium text-ink">{current.title}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{current.prompt}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => open(mode, current)}>
                      <PlayCircle size={13} />
                      Untimed
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => open(mode, current, { startTimer: true })}>
                      <Timer size={13} />
                      Timed {mode === 'A' ? '45' : '60'} min
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <ul className="grid gap-2 lg:grid-cols-2">
              {list.map((question) => {
                const isOpen = openId === question.id;
                const inProgress = activeQuestion === question.id;
                return (
                  <li key={question.id} className="panel overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : question.id)}
                      className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-ink-faint">
                        {question.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{question.title}</span>
                          <Badge tone={question.difficulty === 'Easy' ? 'ok' : 'warn'}>
                            {question.difficulty}
                          </Badge>
                          {inProgress && <Badge tone="brand">in progress</Badge>}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-ink-faint">
                          {question.tags.map((tag) => (
                            <span key={tag} className="rounded border border-line px-1.5 py-0.5">
                              {tag}
                            </span>
                          ))}
                          <span className="flex items-center gap-1">
                            <Clock3 size={10} />≈ {question.minutes} min
                          </span>
                          {question.create && (
                            <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-300">
                              new file
                            </span>
                          )}
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-line bg-canvas/60 px-3.5 py-3">
                        <p className="text-[12.5px] leading-relaxed text-ink-dim">{question.prompt}</p>

                        <div className="rounded-lg border border-line bg-surface-2/60 px-2.5 py-2">
                          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
                            <FileCode2 size={11} />
                            Target file
                          </div>
                          <code className="font-mono text-[11.5px] text-sky-300">{question.file}</code>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
                            <Lightbulb size={11} />
                            Hints
                          </div>
                          <ol className="space-y-1">
                            {question.hints.map((hint, i) => (
                              <li key={hint} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-dim">
                                <span className="font-mono text-ink-faint">{i + 1}.</span>
                                {hint}
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div>
                          <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-faint">
                            Solved when
                          </div>
                          <ul className="space-y-1">
                            {question.acceptance.map((line) => (
                              <li key={line} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-dim">
                                <ArrowRight size={11} className="mt-[3px] shrink-0 text-emerald-400/70" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2 pt-0.5">
                          <Button size="xs" onClick={() => open(mode, question)}>
                            Open untimed
                          </Button>
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => open(mode, question, { startTimer: true })}
                          >
                            Open timed
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {list.length === 0 && (
              <Card className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
                No questions match that filter.
              </Card>
            )}
          </section>
        );
      })}

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Shuffle size={15} className="text-sky-400" />
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-dim">
          <span className="text-ink">Random</span> picks a question you are not currently looking at,
          so repeated practice does not degenerate into memorising one file. Questions marked
          <span className="mx-1 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10.5px] text-violet-300">
            new file
          </span>
          are created for you the moment you open them.
        </p>
        <div className="flex gap-2">
          {['A', 'B'].map((mode) => (
            <Button key={mode} size="sm" onClick={() => pickRandom(mode)}>
              <Shuffle size={12} />
              {mode === 'A' ? 'Debug' : 'Feature'}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export { DEBUGGING_QUESTIONS, FEATURE_QUESTIONS };
