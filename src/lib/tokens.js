/**
 * Token accounting for the AI Copilot budget simulator.
 *
 * The real assessment meter bills:
 *   system prompt + re-sent repo context + user turn + model output + tool-call payload.
 * We reproduce that shape so candidates internalise the real cost of a careless prompt.
 */

export const TOTAL_BUDGET = 200_000;

/** Heuristic tokenizer: ~4 characters per token, floors at 1 for non-empty text. */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(String(text).length / 4));
}

export const COST_MODEL = {
  systemPrompt: 1_250,
  perContextFile: 480,
  activeFileBonus: 900,
  turnOverhead: 320,
  outputRate: 1.08, // tokens charged per generated token (incl. reasoning overhead)
};

export function computeTurnCost({ prompt, contextFiles, activeFile, output }) {
  const input = COST_MODEL.systemPrompt;
  const context = contextFiles.length * COST_MODEL.perContextFile + (activeFile ? COST_MODEL.activeFileBonus : 0);
  const turn = estimateTokens(prompt);
  const generated = Math.round(estimateTokens(output) * COST_MODEL.outputRate);
  const overhead = COST_MODEL.turnOverhead;

  const total = input + context + turn + generated + overhead;
  return {
    input,
    context,
    turn,
    generated,
    overhead,
    total,
  };
}

export function formatTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function formatTokensLong(n) {
  return Math.round(n).toLocaleString('en-US');
}

export function pct(used, total = TOTAL_BUDGET) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}
