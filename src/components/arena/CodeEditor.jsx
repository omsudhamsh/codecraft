import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { tokenize, grammarFor, TOKEN_CLASS } from '../../lib/highlight.js';

const EDITOR_FONT =
  "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export default function CodeEditor({ value, onChange, language, readOnly = false, path }) {
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);

  const grammar = useMemo(() => grammarFor(path ?? ''), [path]);
  const tokens = useMemo(() => tokenize(value ?? '', language ?? grammar), [value, language, grammar]);

  const lines = useMemo(() => (value ?? '').split('\n'), [value]);
  const lineNumbers = useMemo(() => lines.map((_, i) => i + 1), [lines]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  const handleKeyDown = (event) => {
    const ta = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value: current } = ta;

    if (event.key === 'Tab') {
      event.preventDefault();
      const next = `${current.slice(0, start)}  ${current.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(start + 2, start + 2));
      return;
    }

    if (event.key === 'Enter') {
      // Preserve the current indentation, and add one level after an opening brace.
      const lineStart = current.lastIndexOf('\n', start - 1) + 1;
      const line = current.slice(lineStart, start);
      const indent = (line.match(/^[ \t]*/) ?? [''])[0];
      const extra = /[{[(]\s*$/.test(line) ? '  ' : '';
      if (!indent && !extra) return;
      event.preventDefault();
      const insert = `\n${indent}${extra}`;
      onChange(`${current.slice(0, start)}${insert}${current.slice(end)}`);
      requestAnimationFrame(() => ta.setSelectionRange(start + insert.length, start + insert.length));
      return;
    }

    if (event.key === 'Backspace' && start === end) {
      const before = current.slice(0, start);
      const pair = before.match(/(\n)([ \t]+)$/);
      if (pair) {
        event.preventDefault();
        const cutStart = start - pair[2].length;
        onChange(`${current.slice(0, cutStart)}${current.slice(start)}`);
        requestAnimationFrame(() => ta.setSelectionRange(cutStart, cutStart));
      }
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onPaste = (e) => e.preventDefault();
    if (readOnly) ta.addEventListener('paste', onPaste);
    return () => ta.removeEventListener('paste', onPaste);
  }, [readOnly]);

  return (
    <div className="relative flex h-full min-h-0 bg-canvas">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="w-12 shrink-0 select-none overflow-hidden border-r border-line bg-surface/60 py-3 text-right"
      >
        {lineNumbers.map((n) => (
          <div
            key={n}
            className="pr-3 font-mono text-[12px] leading-[20px] text-ink-faint/70 tabular-nums"
            style={{ height: '20px' }}
          >
            {n}
          </div>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto px-4 py-3 scroll-thin"
          style={{ fontFamily: EDITOR_FONT, fontSize: '12.5px', lineHeight: '20px' }}
        >
          <code className="block">
            {tokens.map((t, i) => (
              <span key={i} className={TOKEN_CLASS[t.type] ?? TOKEN_CLASS.plain}>
                {t.value}
              </span>
            ))}
            {'\n'}
          </code>
        </pre>

        <textarea
          ref={textareaRef}
          value={value ?? ''}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          aria-label={`Source code for ${path ?? 'file'}`}
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-4 py-3 text-transparent caret-sky-400 outline-none scroll-thin"
          style={{ fontFamily: EDITOR_FONT, fontSize: '12.5px', lineHeight: '20px' }}
        />
      </div>
    </div>
  );
}
