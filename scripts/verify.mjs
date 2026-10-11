/**
 * Headless self-check for the sandboxed test engine.
 *
 *   node scripts/verify.mjs            both rounds, untouched repo
 *   node scripts/verify.mjs --solved   both rounds, reference solution applied
 *
 * Baseline mode asserts that the shipped repository FAILS every discriminating
 * assertion. Solved mode asserts the reference patch scores 100%, which proves each
 * assertion is both meaningful and achievable.
 */

import { runTestSuite } from '../src/lib/testRunner.js';
import { MODE_A_FILES } from '../src/data/modeA/repo.js';
import { MODE_A_SUITE, MODE_A_MOCKS } from '../src/data/modeA/tests.js';
import { MODE_B_FILES } from '../src/data/modeB/repo.js';
import { MODE_B_SUITE, MODE_B_MOCKS, MODE_B_SEED } from '../src/data/modeB/tests.js';
import { MODE_A_SOLUTION, MODE_B_SOLUTION } from './referenceSolutions.js';

const args = process.argv.slice(2);
const mode = args.includes('--solved') ? 'solved' : 'baseline';
const only = args.find((a) => /^[ab]$/.test(a)) ?? 'all';

async function run(name, suite, files, mocks, seed) {
  const result = await runTestSuite({ suite, files, mocks, seed, onEvent: () => {} });
  console.log(`\n=== ${name} [${mode}] ===`);
  console.log(`${result.passed}/${result.total} passing · score ${result.score}% · ${result.durationMs}ms`);
  for (const r of result.results) {
    const mark = r.status === 'pass' ? '  ok ' : ' FAIL';
    console.log(`${mark} ${r.id}  ${r.title}`);
    if (r.status === 'fail') console.log(`        ${r.message.split('\n')[0].slice(0, 140)}`);
  }
  return result;
}

let exitCode = 0;

if (mode === 'baseline') {
  const runs = [];
  if (only === 'all' || only === 'a') {
    runs.push(await run('Mode A — debugging', MODE_A_SUITE, MODE_A_FILES, MODE_A_MOCKS));
  }
  if (only === 'all' || only === 'b') {
    runs.push(
      await run('Mode B — feature development', MODE_B_SUITE, MODE_B_FILES, MODE_B_MOCKS, MODE_B_SEED),
    );
  }
  for (const r of runs) {
    const guards = r.results.filter((x) => x.status === 'pass');
    console.log(
      `\n${r.suiteId}: ${guards.length} assertion(s) pass on the untouched repo (expected: regression guards only).`,
    );
  }
} else {
  if (only === 'all' || only === 'a') {
    const files = { ...MODE_A_FILES, ...MODE_A_SOLUTION };
    const r = await run('Mode A — debugging', MODE_A_SUITE, files, MODE_A_MOCKS);
    if (r.score < 100) exitCode = 1;
  }
  if (only === 'all' || only === 'b') {
    const files = { ...MODE_B_FILES, ...MODE_B_SOLUTION };
    const r = await run('Mode B — feature development', MODE_B_SUITE, files, MODE_B_MOCKS, MODE_B_SEED);
    if (r.score < 100) exitCode = 1;
  }
}

process.exit(exitCode);
