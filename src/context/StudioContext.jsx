import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { STORAGE_KEYS, loadState, saveState, clearAllState } from '../lib/storage.js';
import { TOTAL_BUDGET } from '../lib/tokens.js';
import { runTestSuite } from '../lib/testRunner.js';

import { MODE_A, MODE_A_FILES } from '../data/modeA/repo.js';
import { MODE_A_SUITE, MODE_A_MOCKS } from '../data/modeA/tests.js';
import { MODE_B, MODE_B_FILES } from '../data/modeB/repo.js';
import { MODE_B_SUITE, MODE_B_MOCKS, MODE_B_SEED } from '../data/modeB/tests.js';
import { answerPrompt } from '../data/copilotEngine.js';

const StudioContext = createContext(null);

export const MODES = {
  A: {
    ...MODE_A,
    baseFiles: MODE_A_FILES,
    suite: MODE_A_SUITE,
    mocks: MODE_A_MOCKS,
    seed: undefined,
  },
  B: {
    ...MODE_B,
    baseFiles: MODE_B_FILES,
    suite: MODE_B_SUITE,
    mocks: MODE_B_MOCKS,
    seed: MODE_B_SEED,
  },
};

const emptySession = (key) => ({
  key,
  status: 'idle', // idle = untimed practice · active · paused · submitted · expired
  startedAt: null,
  endsAt: null,
  remainingMs: MODES[key].durationMinutes * 60 * 1000,
  timed: false,
  stack: 'react-node',
  questionId: null,
  files: { ...MODES[key].baseFiles },
  baselineFiles: { ...MODES[key].baseFiles },
  activeFile: key === 'A' ? 'server/index.js' : 'server/app.js',
  messages: [],
  dirty: {},
  report: null,
  runLog: [],
  running: false,
  submittedAt: null,
});

const initialProgress = {
  runs: [],
  bestScore: { A: null, B: null },
  attempts: { A: 0, B: 0 },
  totalRuns: 0,
  lastRunAt: null,
};

const initialBudget = {
  used: 0,
  limit: TOTAL_BUDGET,
  locked: false,
  turns: [],
  exhaustedAt: null,
  resets: 0,
};

function blankState() {
  return {
    progress: loadState(STORAGE_KEYS.PROGRESS, initialProgress),
    budget: loadState(STORAGE_KEYS.BUDGET, initialBudget),
    sessions: {
      A: loadState(`${STORAGE_KEYS.SESSION}:A`, emptySession('A')),
      B: loadState(`${STORAGE_KEYS.SESSION}:B`, emptySession('B')),
    },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };

    case 'SESSION_PATCH': {
      const { mode, patch } = action;
      return {
        ...state,
        sessions: { ...state.sessions, [mode]: { ...state.sessions[mode], ...patch } },
      };
    }

    case 'FILE_WRITE': {
      const session = state.sessions[action.mode];
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: {
            ...session,
            files: { ...session.files, [action.path]: action.content },
            dirty: { ...session.dirty, [action.path]: true },
          },
        },
      };
    }

    case 'FILE_CREATE': {
      const session = state.sessions[action.mode];
      if (session.files[action.path]) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: {
            ...session,
            files: { ...session.files, [action.path]: action.content },
            dirty: { ...session.dirty, [action.path]: true },
          },
        },
      };
    }

    case 'FILE_DELETE': {
      const session = state.sessions[action.mode];
      const files = { ...session.files };
      delete files[action.path];
      const dirty = { ...session.dirty };
      delete dirty[action.path];
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: { ...session, files, dirty },
        },
      };
    }

    case 'RUN_LOG':
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: { ...state.sessions[action.mode], runLog: [...action.log].slice(-40) },
        },
      };

    case 'RUN_START':
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: { ...state.sessions[action.mode], running: true, runLog: action.log ?? [] },
        },
      };

    case 'RUN_FINISH': {
      const session = state.sessions[action.mode];
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: { ...session, running: false, report: action.report, runLog: action.log },
        },
      };
    }

    case 'SESSION_SUBMIT': {
      const session = state.sessions[action.mode];
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: {
            ...session,
            status: 'submitted',
            submittedAt: action.at,
            remainingMs: session.remainingMs,
          },
        },
      };
    }

    case 'BUDGET_SPEND': {
      const spent = state.budget.used + action.cost;
      const limit = state.budget.limit;
      return {
        ...state,
        budget: {
          ...state.budget,
          used: spent,
          locked: spent >= limit || state.budget.locked,
          exhaustedAt: spent >= limit ? action.at : state.budget.exhaustedAt,
          turns: action.turn ? [...state.budget.turns, action.turn].slice(-60) : state.budget.turns,
        },
      };
    }

    case 'CHAT_APPEND': {
      const session = state.sessions[action.mode];
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.mode]: {
            ...session,
            messages: [...(session.messages ?? []), action.message].slice(-30),
          },
        },
      };
    }

    case 'CHAT_CLEAR': {
      const session = state.sessions[action.mode];
      return {
        ...state,
        sessions: { ...state.sessions, [action.mode]: { ...session, messages: [] } },
      };
    }

    case 'BUDGET_RESET':
      return {
        ...state,
        budget: { ...structuredClone(initialBudget), resets: state.budget.resets + 1 },
      };

    case 'PROGRESS_RECORD': {
      const { mode, report, at, timeUsedMs } = action;
      const runs = [
        ...state.progress.runs,
        {
          id: `${mode}-${at}`,
          mode,
          at,
          score: report.score,
          passed: report.passed,
          failed: report.failed,
          total: report.total,
          durationMs: report.durationMs,
          timeUsedMs,
          verdict: report.verdict,
          failing: report.results.filter((r) => r.status === 'fail').map((r) => r.id),
        },
      ].slice(-40);

      return {
        ...state,
        progress: {
          runs,
          bestScore: {
            ...state.progress.bestScore,
            [mode]: Math.max(state.progress.bestScore[mode] ?? 0, report.score),
          },
          attempts: { ...state.progress.attempts, [mode]: (state.progress.attempts[mode] ?? 0) + 1 },
          totalRuns: state.progress.totalRuns + 1,
          lastRunAt: at,
        },
      };
    }

    case 'RESET_ALL':
      return {
        progress: structuredClone(initialProgress),
        budget: structuredClone(initialBudget),
        sessions: { A: emptySession('A'), B: emptySession('B') },
      };

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- helpers */

const CHANGED_FILES_HINT = [
  'server/index.js',
  'server/routes/products.js',
  'server/middleware/auth.js',
  'server/utils/pricing.js',
  'client/src/hooks/useProducts.js',
];

export function StudioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, blankState);
  const runIdRef = useRef(0);
  const persistTimer = useRef(null);

  /* ---------------------------------------------------------------- persistence
     The countdown dispatches every 250ms while a timer runs, so a debounce keyed on the
     state object would be cancelled forever and nothing would ever reach localStorage.
     Instead: a cheap signature decides *whether* to write, and a self-resetting interval
     decides *when*. Flushing on an interval means the last state before a close is written. */
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastPersisted = useRef('');

  useEffect(() => {
    const strip = (session) => {
      const { remainingMs, ...rest } = session;
      return session.status === 'active' ? rest : { ...rest, remainingMs };
    };

    const signature = (s) =>
      JSON.stringify([
        s.budget.used,
        s.budget.turns.length,
        s.budget.resets,
        s.progress.runs.length,
        ['A', 'B'].map((mode) => {
          const session = s.sessions[mode];
          return [
            session.status,
            session.timed,
            session.stack,
            session.endsAt,
            session.remainingMs,
            session.questionId,
            session.messages?.length ?? 0,
            session.report?.ranAt ?? null,
            session.running,
            Object.keys(session.files).length,
            Object.values(session.dirty).filter(Boolean).length,
          ];
        }),
      ]);

    const flush = () => {
      const current = stateRef.current;
      const next = signature(current);
      if (next === lastPersisted.current) return;
      lastPersisted.current = next;

      saveState(STORAGE_KEYS.PROGRESS, current.progress);
      saveState(STORAGE_KEYS.BUDGET, current.budget);
      saveState(`${STORAGE_KEYS.SESSION}:A`, strip(current.sessions.A));
      saveState(`${STORAGE_KEYS.SESSION}:B`, strip(current.sessions.B));
    };

    flush();
    const handle = setInterval(flush, 1000);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(handle);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  /* ---------------------------------------------------------------- countdown */
  const sessionsRef = useRef(state.sessions);
  sessionsRef.current = state.sessions;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      ['A', 'B'].forEach((mode) => {
        const session = sessionsRef.current[mode];
        if (session.status !== 'active' || !session.endsAt) return;
        const remainingMs = Math.max(0, session.endsAt - now);
        dispatch({
          type: 'SESSION_PATCH',
          mode,
          patch: remainingMs === 0 ? { remainingMs, status: 'expired' } : { remainingMs },
        });
      });
    }, 250);
    return () => clearInterval(timer);
  }, []);

  /* ---------------------------------------------------------------- actions */
  const startSession = useCallback((mode, { stack = 'react-node', timed = true } = {}) => {
    const durationMs = MODES[mode].durationMinutes * 60 * 1000;
    const now = Date.now();
    dispatch({
      type: 'SESSION_PATCH',
      mode,
      patch: {
        status: timed ? 'active' : 'idle',
        timed,
        stack,
        startedAt: timed ? now : null,
        endsAt: timed ? now + durationMs : null,
        remainingMs: durationMs,
        report: null,
        runLog: [],
        submittedAt: null,
      },
    });
  }, []);

  const resetSession = useCallback((mode) => {
    dispatch({ type: 'SESSION_PATCH', mode, patch: emptySession(mode) });
    saveState(`${STORAGE_KEYS.SESSION}:${mode}`, emptySession(mode));
  }, []);

  const pauseSession = useCallback((mode) => {
    dispatch({ type: 'SESSION_PATCH', mode, patch: { status: 'paused' } });
  }, []);

  const resumeSession = useCallback((mode) => {
    const session = state.sessions[mode];
    if (session.status !== 'paused') return;
    dispatch({
      type: 'SESSION_PATCH',
      mode,
      patch: { status: 'active', endsAt: Date.now() + session.remainingMs },
    });
  }, [state.sessions]);

  const openFile = useCallback((mode, path) => {
    dispatch({ type: 'SESSION_PATCH', mode, patch: { activeFile: path } });
  }, []);

  const writeFile = useCallback((mode, path, content) => {
    dispatch({ type: 'FILE_WRITE', mode, path, content });
  }, []);

  const createFile = useCallback((mode, path, content) => {
    dispatch({ type: 'FILE_CREATE', mode, path, content });
  }, []);

  const deleteFile = useCallback((mode, path) => {
    dispatch({ type: 'FILE_DELETE', mode, path });
  }, []);

  const revertFile = useCallback((mode, path) => {
    const session = state.sessions[mode];
    const base = session.baselineFiles[path];
    if (base === undefined) return;
    dispatch({ type: 'FILE_WRITE', mode, path, content: base });
  }, [state.sessions]);

  /** Attach a question from the bank: it becomes the focus and its file opens. */
  const setQuestion = useCallback((mode, question) => {
    if (!question) return;
    const patch = { questionId: question.id };
    if (question.file && question.create) {
      // Create-on-demand: the story expects this file to be authored.
      patch.files = { ...state.sessions[mode].files };
      if (!patch.files[question.file]) {
        patch.files[question.file] = headerFor(question);
        patch.dirty = { ...state.sessions[mode].dirty, [question.file]: true };
      }
    }
    if (question.file) patch.activeFile = question.file;
    dispatch({ type: 'SESSION_PATCH', mode, patch });
  }, [state.sessions]);

  const resetBudget = useCallback(() => {
    dispatch({ type: 'BUDGET_RESET' });
  }, []);

  /* ---------------------------------------------------------------- tests */
  const runTests = useCallback(
    async (mode) => {
      const session = state.sessions[mode];
      if (session.running) return null;

      const runId = ++runIdRef.current;
      const collected = [{ level: 'info', text: 'Preparing sandbox…', at: Date.now() }];
      dispatch({ type: 'RUN_START', mode, log: collected });

      const spec = MODES[mode];
      const result = await runTestSuite({
        suite: spec.suite,
        files: session.files,
        mocks: spec.mocks,
        seed: spec.seed,
        onEvent: (event) => {
          if (runId !== runIdRef.current) return;
          if (event.type === 'boot') {
            collected.push({ level: 'info', text: event.label, at: Date.now() });
          }
          if (event.type === 'test-start') {
            const test = spec.suite.tests.find((t) => t.id === event.id);
            collected.push({ level: 'run', text: `▶ ${event.id}  ${test?.title ?? ''}`, at: Date.now() });
            dispatch({ type: 'RUN_LOG', mode, log: [...collected] });
          }
        },
      });

      if (runId !== runIdRef.current) return null;

      const at = new Date().toISOString();
      const finalLog = result.results.map((r) => ({
        level: r.status === 'pass' ? 'pass' : 'fail',
        text: `${r.status === 'pass' ? '✓' : '✗'} ${r.id}  ${r.title}`,
        at: Date.parse(at),
      }));

      dispatch({ type: 'RUN_FINISH', mode, report: result, log: finalLog });
      dispatch({
        type: 'PROGRESS_RECORD',
        mode,
        report: result,
        at,
        timeUsedMs: session.startedAt ? Date.now() - session.startedAt : 0,
      });

      return result;
    },
    [state.sessions],
  );

  /* ---------------------------------------------------------------- copilot */
  const appendMessage = useCallback((mode, message) => {
    dispatch({ type: 'CHAT_APPEND', mode, message });
  }, []);

  const clearChat = useCallback((mode) => {
    dispatch({ type: 'CHAT_CLEAR', mode });
  }, []);

  const askCopilot = useCallback(
    (mode, prompt) => {
      const session = state.sessions[mode];
      const report = session.report;
      void report;

      appendMessage(mode, {
        id: `u${Date.now()}`,
        role: 'user',
        text: prompt,
        at: new Date().toISOString(),
      });

      const response = answerPrompt({
        prompt,
        mode,
        files: session.files,
        activeFile: session.activeFile,
        report: session.report,
        history: state.budget.turns.filter((t) => t.mode === mode),
      });

      const at = new Date().toISOString();
      dispatch({
        type: 'BUDGET_SPEND',
        cost: response.cost.total,
        at,
        turn: {
          id: `t${state.budget.turns.length + 1}`,
          at,
          mode,
          prompt,
          title: response.title,
          cost: response.cost,
          contextFiles: response.contextFiles,
        },
      });

      return { ...response, at };
    },
    [state.sessions, state.budget.turns, appendMessage],
  );

  const resetEverything = useCallback(() => {
    clearAllState();
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      modes: MODES,
      actions: {
        startSession,
        resetSession,
        pauseSession,
        resumeSession,
        openFile,
        writeFile,
        createFile,
        deleteFile,
        revertFile,
        setQuestion,
        resetBudget,
        runTests,
        askCopilot,
        appendMessage,
        clearChat,
        resetEverything,
      },
    }),
    [
      state,
      startSession,
      resetSession,
      pauseSession,
      resumeSession,
      openFile,
      writeFile,
      createFile,
      deleteFile,
      revertFile,
      setQuestion,
      resetBudget,
      runTests,
      askCopilot,
      appendMessage,
      clearChat,
      resetEverything,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>');
  return ctx;
}

const STARTERS = {
  'server/middleware/authorize.js':
    "const { forbidden, unauthorized } = require('../utils/errors');\n\n" +
    '// TODO(feature): export authorize(...roles) -> Express middleware\n\n' +
    'module.exports = {};\n',
  'client/src/utils/permissions.js':
    '// TODO(feature): export can(user, action, task) -> boolean\n\n' +
    'module.exports = {};\n',
};

function headerFor(question) {
  return STARTERS[question.file] ?? '// new module\n';
}

export { MODES as MODE_SPECS };
