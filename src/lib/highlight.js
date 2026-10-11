/**
 * Dependency-free syntax highlighter.
 *
 * A single master regex with ordered alternatives is enough for the token streams
 * produced by this app (JS / JSX / JSON / CSS / Markdown). Keeping it in-repo avoids
 * shipping a full parser (Monaco) for an editor surface that only ever renders
 * single-digit-thousand-line snippets.
 */

const JS_RULES = [
  ['block-comment', /\/\*[\s\S]*?(?:\*\/|$)/y],
  ['line-comment', /\/\/[^\n]*/y],
  ['template', /`(?:[^`\\]|\\[\s\S])*`?/y],
  ['string', /"(?:[^"\\\n]|\\.)*"?/y],
  ['string', /'(?:[^'\\\n]|\\.)*'?/y],
  [
    'keyword',
    /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|export|from|delete|void|static|with)\b/y,
  ],
  ['literal', /\b(?:true|false|null|undefined|NaN|Infinity)\b/y],
  ['number', /\b0[xXbBoO][0-9a-fA-F_]+n?\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y],
  ['jsx-tag', /(?<![$\w])(?:<\/?)(?:[A-Z][\w.]*|[a-z][\w-]*)(?=[\s/>])/y],
  ['jsx-attr', /(?<=[<\s])[A-Za-z][\w-]*(?==)/y],
  ['type', /\b[A-Z][A-Za-z0-9_$]*\b/y],
  ['fn', /\b[a-zA-Z_$][\w$]*(?=\s*\()/y],
  ['prop', /\b[a-zA-Z_$][\w$]*(?=\s*:)/y],
  ['operator', /=>|\.{3}|[?][.]|[=!]==?|[<>]=?|&&|\|\||\?\?|[+\-*/%!~^&|]|\binstanceof\b/y],
  ['punct', /[{}()[\];,.:]/y],
];

const CSS_RULES = [
  ['block-comment', /\/\*[\s\S]*?(?:\*\/|$)/y],
  ['string', /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y],
  ['keyword', /@[a-zA-Z-]+/y],
  ['number', /\b-?\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|fr|deg)?\b/y],
  ['literal', /#[0-9a-fA-F]{3,8}\b|\b(?:true|false|null)\b/y],
  ['prop', /[-a-zA-Z]+(?=\s*:)/y],
  ['fn', /\b[a-zA-Z-]+(?=\()/y],
  ['punct', /[{}();,:]/y],
];

const MD_RULES = [
  ['heading', /^#{1,6} .*$/y],
  ['code', /`[^`\n]+`/y],
  ['bold', /\*\*[^*\n]+\*\*|__[^_\n]+__/y],
  ['operator', /\[[^\]\n]*\]\([^)\n]*\)/y],
  ['punct', /[*_~>|-]/y],
];

const GRAMMARS = {
  js: JS_RULES,
  jsx: JS_RULES,
  javascript: JS_RULES,
  typescript: JS_RULES,
  json: JS_RULES,
  css: CSS_RULES,
  markdown: MD_RULES,
  md: MD_RULES,
  text: [],
};

export function grammarFor(filePath = '') {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'css') return 'css';
  if (ext === 'md') return 'markdown';
  if (ext === 'json') return 'json';
  return 'jsx';
}

/** @returns {{type: string, value: string}[]} */
export function tokenize(code, language = 'jsx') {
  const rules = GRAMMARS[language] ?? JS_RULES;
  const src = String(code ?? '');
  const out = [];
  let i = 0;

  while (i < src.length) {
    let matched = false;

    for (const [type, sticky] of rules) {
      sticky.lastIndex = i;
      const m = sticky.exec(src);
      if (m && m[0].length > 0) {
        out.push({ type, value: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const prev = out[out.length - 1];
      if (prev && prev.type === 'plain') prev.value += src[i];
      else out.push({ type: 'plain', value: src[i] });
      i += 1;
    }
  }

  return out;
}

export const TOKEN_CLASS = {
  'line-comment': 'text-slate-500 italic',
  'block-comment': 'text-slate-500 italic',
  keyword: 'text-violet-300',
  literal: 'text-amber-300',
  string: 'text-emerald-300',
  template: 'text-emerald-300',
  number: 'text-amber-300',
  fn: 'text-sky-300',
  type: 'text-cyan-300',
  prop: 'text-slate-200',
  'jsx-tag': 'text-rose-300',
  'jsx-attr': 'text-sky-200',
  operator: 'text-slate-400',
  punct: 'text-slate-500',
  heading: 'text-sky-300 font-semibold',
  bold: 'text-slate-100 font-semibold',
  code: 'text-emerald-300',
  plain: 'text-slate-300',
};
