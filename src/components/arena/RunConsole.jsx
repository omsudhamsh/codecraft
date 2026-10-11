import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

const LEVEL_STYLE = {
  info: 'text-ink-faint',
  run: 'text-sky-300',
  pass: 'text-emerald-400',
  fail: 'text-rose-400',
};

export default function RunConsole({ log }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [log]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Terminal size={12} className="text-ink-faint" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Test runner
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 scroll-thin">
        {log.length === 0 && (
          <p className="font-mono text-[11px] text-ink-faint">
            Run the suite to see output here.
          </p>
        )}
        {log.map((entry, i) => (
          <div
            key={i}
            className={`font-mono text-[11px] leading-[1.7] ${LEVEL_STYLE[entry.level] ?? 'text-ink-dim'}`}
          >
            {entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
