/**
 * Measures the token cost of the assistant across representative prompts.
 *
 * The point of the brief-by-default rewrite was that a simple question should stop
 * costing a page of prose. This reports answer length and billed tokens side by side so
 * a regression is visible rather than assumed.
 *
 *   node scripts/measure-tokens.mjs
 */

import { answerPrompt } from '../src/data/copilotEngine.js';
import { MODE_A_FILES } from '../src/data/modeA/repo.js';
import { MODE_A_TESTS } from '../src/data/modeA/tests.js';
import { MODE_B_FILES } from '../src/data/modeB/repo.js';
import { MODE_B_TESTS } from '../src/data/modeB/tests.js';

const failingReport = (tests) => ({
  results: tests.map((t) => ({
    id: t.id,
    title: t.title,
    file: t.file,
    status: 'fail',
    kind: t.kind,
  })),
});

const PROMPTS = [
  ['what does ?? do', null],
  ['how does async work', null],
  ['explain react props', null],
  ['what is 401 vs 403', null],
  ['which files have errors', null],
  ['how are the routes connected', null],
  ['fix the error for me', null],
  ['why is my test failing', 'D-01'],
  ['what should I look at', 'D-03'],
  ['help me solve this', 'D-05'],
  ['in detail: what does ?? do', null],
  ['in detail: explain react props', null],
];

const run = (mode, files, tests, questionId) =>
  PROMPTS.map(([prompt, q]) => {
    const res = answerPrompt({
      prompt,
      mode,
      files,
      activeFile: files[Object.keys(files)[0]],
      report: failingReport(tests),
      questionId: q ?? questionId,
    });
    return { prompt, q, res };
  });

const rows = [
  ...run('A', MODE_A_FILES, MODE_A_TESTS, null),
  ...run('B', MODE_B_FILES, MODE_B_TESTS, null),
];

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(
  `${pad('prompt', 34)}${pad('scope', 7)}${pad('words', 7)}${pad('chars', 7)}${pad('gen tok', 9)}${pad('ctx tok', 9)}total`,
);
console.log('-'.repeat(84));

let briefTotal = 0;
let briefCount = 0;
let detailTotal = 0;
let detailCount = 0;

for (const { prompt, res } of rows) {
  const words = res.answer.split(/\s+/).filter(Boolean).length;
  const chars = res.answer.length;
  console.log(
    pad(prompt, 34) +
      pad(res.detailed ? 'detail' : 'brief', 7) +
      pad(words, 7) +
      pad(chars, 7) +
      pad(res.cost.generated, 9) +
      pad(res.cost.context, 9) +
      res.cost.total,
  );
  if (res.detailed) {
    detailTotal += res.cost.total;
    detailCount += 1;
  } else {
    briefTotal += res.cost.total;
    briefCount += 1;
  }
}

console.log('-'.repeat(84));
console.log(
  `brief   avg ${Math.round(briefTotal / briefCount)} tokens over ${briefCount} prompts`,
);
console.log(
  `detail  avg ${Math.round(detailTotal / detailCount)} tokens over ${detailCount} prompts`,
);
console.log(`saving  ${Math.round((1 - briefTotal / briefCount / (detailTotal / detailCount)) * 100)}%`);
