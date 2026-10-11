import { useMemo } from 'react';

import { tokenize, grammarFor, TOKEN_CLASS } from '../../lib/highlight.js';

const INLINE_RULES = [
  ['code', /`([^`\n]+)`/],
  ['strong', /\*\*([^*\n]+)\*\*/],
  ['em', /(?<![*\w])\*([^*\n]+)\*(?!\*)/],
  ['strike', /~~([^~\n]+)~~/],
  ['link', /\[([^\]\n]+)\]\(([^)\s]+)\)/],
];

/** Render inline markdown (code, bold, italic, links) into React nodes. */
export function renderInline(text, keyPrefix = 'i') {
  const nodes = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    let bestIndex = Infinity;
    let bestRule = null;
    let bestMatch = null;

    for (const [rule, regex] of INLINE_RULES) {
      const m = regex.exec(rest);
      if (m && m.index < bestIndex) {
        bestIndex = m.index;
        bestRule = rule;
        bestMatch = m;
      }
    }

    if (!bestMatch) {
      nodes.push(rest);
      break;
    }

    if (bestIndex > 0) nodes.push(rest.slice(0, bestIndex));

    const id = `${keyPrefix}-${key++}`;
    if (bestRule === 'code') {
      nodes.push(
        <code
          key={id}
          className="rounded border border-line bg-surface-3 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-300"
        >
          {bestMatch[1]}
        </code>,
      );
    } else if (bestRule === 'strong') {
      nodes.push(<strong key={id} className="font-semibold text-ink">{bestMatch[1]}</strong>);
    } else if (bestRule === 'em') {
      nodes.push(<em key={id} className="italic text-ink-dim">{bestMatch[1]}</em>);
    } else if (bestRule === 'strike') {
      nodes.push(<span key={id} className="line-through text-ink-faint">{bestMatch[1]}</span>);
    } else if (bestRule === 'link') {
      nodes.push(
        <a
          key={id}
          href={bestMatch[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          {bestMatch[1]}
        </a>,
      );
    }

    rest = rest.slice(bestIndex + bestMatch[0].length);
  }

  return nodes;
}

/** Block-level markdown → React. Supports headings, fences, quotes, lists, tables, rules. */
export default function Markdown({ content, className = '' }) {
  const blocks = useMemo(() => parseBlocks(content ?? ''), [content]);

  return (
    <div className={`space-y-3 text-[13px] leading-relaxed text-ink-dim ${className}`}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

function renderBlock(block, i) {
  switch (block.type) {
    case 'heading': {
      const sizes = {
        1: 'text-base font-semibold text-ink mt-1',
        2: 'text-[15px] font-semibold text-ink mt-2',
        3: 'text-sm font-semibold text-sky-300',
        4: 'text-[13px] font-semibold text-ink-dim',
      };
      const Tag = `h${Math.min(block.level + 2, 6)}`;
      return (
        <Tag key={i} className={`${sizes[block.level] ?? sizes[4]} border-b border-line-soft pb-1.5`}>
          {renderInline(block.text, `h${i}`)}
        </Tag>
      );
    }

    case 'code':
      return (
        <pre
          key={i}
          className="overflow-x-auto rounded-lg border border-line bg-canvas p-3 font-mono text-[12px] leading-[1.65] scroll-thin"
        >
          <CodeBody code={block.code} lang={block.lang} />
        </pre>
      );

    case 'quote':
      return (
        <blockquote
          key={i}
          className="border-l-2 border-sky-500/60 bg-sky-500/[0.06] py-2 pl-3 pr-2 text-[12.5px] text-sky-100"
        >
          {renderInline(block.text, `q${i}`)}
        </blockquote>
      );

    case 'list':
      return (
        <ul key={i} className="space-y-1.5 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-sky-500/70" />
              <span>{renderInline(item, `l${i}-${j}`)}</span>
            </li>
          ))}
        </ul>
      );

    case 'ordered':
      return (
        <ol key={i} className="space-y-1.5 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-3 font-mono text-[10px] text-sky-300">
                {j + 1}
              </span>
              <span>{renderInline(item, `o${i}-${j}`)}</span>
            </li>
          ))}
        </ol>
      );

    case 'table':
      return (
        <div key={i} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-surface-3">
                {block.head.map((h, j) => (
                  <th key={j} className="border-b border-line px-3 py-1.5 text-left font-semibold text-ink">
                    {renderInline(h, `th${i}-${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j} className="odd:bg-surface/40">
                  {row.map((cell, k) => (
                    <td key={k} className="border-b border-line-soft px-3 py-1.5 align-top">
                      {renderInline(cell, `td${i}-${j}-${k}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'rule':
      return <hr key={i} className="border-line" />;

    default:
      return (
        <p key={i} className="text-ink-dim">
          {renderInline(block.text, `p${i}`)}
        </p>
      );
  }
}

function CodeBody({ code, lang }) {
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);
  return (
    <code className="block">
      {tokens.map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.type] ?? TOKEN_CLASS.plain}>
          {t.value}
        </span>
      ))}
    </code>
  );
}

function parseBlocks(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'javascript';
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lang: normaliseLang(lang), code: body.join('\n') });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }

    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i += 1;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const items = [];
      while (i < lines.length) {
        const b = /^\s*[-*+]\s+(.*)$/.exec(lines[i]);
        const n = /^\s*\d+\.\s+(.*)$/.exec(lines[i]);
        if (b) items.push(b[1]);
        else if (n) items.push(n[1]);
        else break;
        i += 1;
      }
      blocks.push({ type: bullet ? 'list' : 'ordered', items });
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }

  return blocks;
}

function normaliseLang(lang) {
  const l = lang.toLowerCase();
  if (l.startsWith('js') || l === 'node') return 'javascript';
  if (l === 'ts' || l.startsWith('typescript')) return 'typescript';
  if (l === 'json') return 'json';
  if (l === 'css') return 'css';
  return 'javascript';
}

export { grammarFor };
