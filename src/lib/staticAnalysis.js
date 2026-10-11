/**
 * Structural analysis helpers used by the static half of the test suites.
 * Deliberately conservative: we assert intent ("this promise chain can reject"),
 * not formatting.
 */

import { tokenize } from './highlight.js';

export function stripComments(source) {
  return tokenize(source, 'jsx')
    .filter((t) => t.type !== 'line-comment' && t.type !== 'block-comment')
    .map((t) => t.value)
    .join('');
}

export function matches(source, regex) {
  return regex.test(stripComments(source));
}

export function countMatches(source, regex) {
  const src = stripComments(source);
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  return (src.match(re) ?? []).length;
}

/** Locate every `useEffect(` / `useMemo(` / `useCallback(` invocation with its argument span. */
export function findHookCalls(source, hookName = 'useEffect') {
  const src = stripComments(source);
  const out = [];
  const re = new RegExp(`\\b${hookName}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('(', m.index);
    let depth = 0;
    let i = open;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push({
      index: m.index,
      open,
      close: i,
      args: src.slice(open + 1, i),
    });
    re.lastIndex = i;
  }
  return out;
}

/** Second argument of a hook call (the dependency array), or null when omitted. */
export function hookDeps(call) {
  const args = splitTopLevel(call.args);
  return args.length >= 2 ? args[1].trim() : null;
}

export function splitTopLevel(input) {
  const parts = [];
  let depth = 0;
  let current = '';
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const prev = input[i - 1];
    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `.then(` calls whose chain has no `.catch(` and no enclosing `await`. */
export function findUnguardedThenCalls(source) {
  const src = stripComments(source);
  const risky = [];
  const re = /\.then\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const chain = src.slice(m.index, m.index + 400);
    const terminal = chain.slice(0, Math.max(chain.indexOf(';'), chain.indexOf('}')));
    const hasCatch = /\.catch\s*\(|\.finally\s*\(/.test(terminal);
    const isAwaited = new RegExp(`await\\s{0,40}${escapeRe(src.slice(Math.max(0, m.index - 60), m.index))}`).test(src);
    if (!hasCatch && !isAwaited) {
      risky.push({
        index: m.index,
        snippet: src.slice(Math.max(0, m.index - 60), m.index + 120).trim(),
      });
    }
  }
  return risky;
}

/** Names exported via CommonJS or ESM syntax. */
export function findExportedNames(source) {
  const src = stripComments(source);
  const names = new Set();
  const patterns = [
    /module\.exports\s*=\s*\{([^}]*)\}/g,
    /module\.exports\s*=\s*([A-Za-z_$][\w$]*)/g,
    /exports\.([A-Za-z_$][\w$]*)\s*=/g,
    /export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
    /export\s*\{([^}]*)\}/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      for (const part of m[1].split(',')) {
        const name = part.split(':').pop().trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
      }
    }
  }
  return [...names];
}
