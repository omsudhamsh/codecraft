import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Ban,
  Eraser,
  FileCode2,
  FileQuestion,
  Lightbulb,
  Lock,
  Map,
  Sparkles,
} from 'lucide-react';

import Markdown from '../common/Markdown.jsx';
import Button from '../ui/Button.jsx';
import { formatTokens } from '../../lib/tokens.js';
import { useStudio } from '../../context/StudioContext.jsx';
import { SUGGESTED_PROMPTS, STARTUP_TIPS } from '../../data/copilotKnowledge.js';

const THINKING_MS = 520;

const KIND_META = {
  navigation: { icon: Map, tone: 'text-sky-300', label: 'navigation' },
  boundary: { icon: Ban, tone: 'text-rose-300', label: 'boundary' },
  concept: { icon: Lightbulb, tone: 'text-violet-300', label: 'concept' },
  process: { icon: Lightbulb, tone: 'text-violet-300', label: 'process' },
};

export default function CopilotPanel({ mode, onExhausted }) {
  const { sessions, budget, actions } = useStudio();
  const session = sessions[mode];
  const messages = session.messages ?? [];

  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  const locked = budget.locked;
  const readOnly = session.status === 'submitted';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking]);

  const submit = (prompt) => {
    const text = (prompt ?? draft).trim();
    if (!text || thinking || locked) return;

    setDraft('');
    setThinking(true);
    const response = actions.askCopilot(mode, text);

    window.setTimeout(() => {
      actions.appendMessage(mode, {
        id: `a${Date.now()}`,
        role: 'assistant',
        text: response.answer,
        title: response.title,
        kind: response.kind,
        links: response.links,
        cost: response.cost,
        contextFiles: response.contextFiles,
        followUps: response.followUps,
        at: response.at,
      });
      setThinking(false);
    }, THINKING_MS);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <Sparkles size={13} className="text-violet-300" />
        <span className="text-[11.5px] font-medium uppercase tracking-wider text-ink-dim">
          AI Assistant
        </span>
        <span
          className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-faint"
          title="This assistant points at files and explains concepts. It will not apply fixes."
        >
          Tutor mode
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => actions.clearChat(mode)}
            title="Clear conversation"
            className="ml-auto rounded p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink-dim"
          >
            <Eraser size={12} />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 scroll-thin">
        {messages.length === 0 && <EmptyState mode={mode} />}

        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              mode={mode}
              onOpenFile={actions.openFile}
              onFollowUp={submit}
            />
          ),
        )}

        {thinking && (
          <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <span className="shimmer h-1.5 w-24 rounded-full" />
            Reading repository context…
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line p-2.5">
        {locked ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-200">
            <Lock size={14} className="shrink-0" />
            <span className="flex-1">Budget exhausted — the assistant is locked.</span>
            <Button size="xs" variant="danger" onClick={onExhausted}>
              Details
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <textarea
                value={draft}
                disabled={readOnly || thinking}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={
                  readOnly
                    ? 'This round has been submitted.'
                    : 'Ask where the errors are, or ask for a concept…  (Enter to send)'
                }
                className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 pr-10 text-[12.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-sky-500/50 disabled:opacity-50 scroll-thin"
              />
              <button
                type="button"
                onClick={() => submit()}
                disabled={!draft.trim() || thinking || readOnly}
                aria-label="Send prompt"
                className="absolute bottom-2 right-2 rounded-md bg-sky-500 p-1.5 text-slate-950 transition-colors hover:bg-sky-400 disabled:bg-surface-3 disabled:text-ink-faint"
              >
                <ArrowUp size={13} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(SUGGESTED_PROMPTS[mode] ?? []).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submit(prompt)}
                  disabled={readOnly || thinking}
                  className="max-w-full truncate rounded-md border border-line px-2 py-1 text-left text-[10.5px] text-ink-faint transition-colors hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function EmptyState({ mode }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-surface-2/50 p-3">
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          I have the complete file map of{' '}
          <span className="font-mono text-ink">
            {mode === 'A' ? 'shopsync-inventory-console' : 'taskflow-web'}
          </span>{' '}
          and I can see which of your files still have open problems.
        </p>
        <div className="mt-2.5 space-y-1.5">
          <Limit icon={Map} tone="text-sky-300">
            <strong className="text-ink-dim">I will</strong> point you at the exact file paths, clickable.
          </Limit>
          <Limit icon={Lightbulb} tone="text-violet-300">
            <strong className="text-ink-dim">I will</strong> teach the concept behind a rule.
          </Limit>
          <Limit icon={Ban} tone="text-rose-300">
            <strong className="text-ink-dim">I will not</strong> write the fix, or apply an edit for you.
          </Limit>
        </div>
      </div>

      <ul className="space-y-1.5">
        {STARTUP_TIPS.map((tip) => (
          <li key={tip} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-faint">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sky-500/60" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Limit({ icon: Icon, tone, children }) {
  return (
    <div className="flex gap-2 text-[11.5px] leading-relaxed text-ink-faint">
      <Icon size={12} className={`mt-[3px] shrink-0 ${tone}`} />
      <span>{children}</span>
    </div>
  );
}

function UserMessage({ message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] rounded-xl rounded-br-sm bg-sky-500/12 px-3 py-2 text-[12.5px] leading-relaxed text-sky-100">
        {message.text}
      </div>
    </div>
  );
}

function AssistantMessage({ message, mode, onOpenFile, onFollowUp }) {
  const [showCost, setShowCost] = useState(false);
  const meta = KIND_META[message.kind] ?? KIND_META.concept;
  const Icon = meta.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
          <Icon size={11} />
        </div>
        <span className="text-[11.5px] font-medium text-ink-dim">{message.title}</span>
        <span className={`rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${meta.tone}`}>
          {meta.label}
        </span>
        {message.cost && (
          <button
            type="button"
            onClick={() => setShowCost((v) => !v)}
            title="Show token breakdown"
            className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-300/80 transition-colors hover:border-amber-500/40"
          >
            −{formatTokens(message.cost.total)} tok
          </button>
        )}
      </div>

      {showCost && message.cost && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[10.5px] text-ink-faint">
          <CostRow label="system prompt" value={message.cost.input} />
          <CostRow label="repo context" value={message.cost.context} />
          <CostRow label="your prompt" value={message.cost.turn} />
          <CostRow label="generated" value={message.cost.generated} />
          <CostRow label="overhead" value={message.cost.overhead} />
          <CostRow label="total" value={message.cost.total} accent />
          {message.contextFiles?.length > 0 && (
            <div className="col-span-2 mt-1 border-t border-line pt-1 text-[10px]">
              context files: {message.contextFiles.join(', ')}
            </div>
          )}
        </dl>
      )}

      <Markdown content={message.text} />

      {message.links?.length > 0 && (
        <div className="space-y-1.5">
          {message.links.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => onOpenFile(mode, link.path)}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-sky-500/50 hover:bg-surface-3"
            >
              <FileCode2 size={13} className="shrink-0 text-sky-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11.5px] text-ink">{link.path}</span>
                <span className="mt-0.5 block text-[10.5px] text-ink-faint">
                  {link.detail}
                  {link.question ? ` · question ${link.question}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[9.5px] uppercase tracking-wide text-ink-faint">
                {link.source === 'scan' ? 'open' : 'failing'}
              </span>
            </button>
          ))}
        </div>
      )}

      {(message.followUps ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {message.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] text-ink-faint transition-colors hover:border-sky-500/40 hover:text-sky-300"
            >
              <FileQuestion size={10} />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CostRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{label}</dt>
      <dd className={accent ? 'text-amber-300' : 'text-ink-dim'}>{value}</dd>
    </div>
  );
}
