/**
 * End-to-end smoke test driven through the Chrome DevTools Protocol.
 *
 *   npm run e2e        (requires a dev server on $E2E_URL, default http://localhost:5199)
 *
 * Exercises the real user path: dashboard controls, question bank + random picker,
 * optional timer, suite run, tutor-mode assistant (locate vs refuse), budget reset.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const URL_UNDER_TEST = process.env.E2E_URL ?? 'http://localhost:5199';
const PORT = 9333;

const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge binary found — skipping e2e smoke test.');
  process.exit(0);
}

const userDataDir = path.join(os.tmpdir(), 'capex-e2e-profile');
fs.rmSync(userDataDir, { recursive: true, force: true });

const proc = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1680,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const cleanup = () => {
  try {
    proc.kill();
  } catch {
    /* already gone */
  }
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* chrome may still hold the profile */
  }
};
process.on('exit', cleanup);

async function targetSocket() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(
          msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text,
        );
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  }
}

const failures = [];
const check = (label, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(label);
};

async function main() {
  const wsUrl = await targetSocket();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  // Headless Chrome never answers window.confirm, which several controls rely on.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.confirm = () => true; window.alert = () => {};',
  });

  const DOC = 'document.body.textContent';

  const goto = async (path) => {
    await cdp.send('Page.navigate', { url: `${URL_UNDER_TEST}${path}` });
    await sleep(2200);
  };

  const text = () => cdp.evaluate(DOC);

  const clickByText = (needle) => `
    (() => {
      const el = [...document.querySelectorAll('button, a')]
        .find((n) => n.textContent.trim().toLowerCase().includes(${JSON.stringify(needle.toLowerCase())}));
      if (!el) return 'not-found';
      el.click();
      return 'clicked';
    })()`;

  const ask = (prompt) => `
    (() => {
      const ta = document.querySelector('textarea[placeholder*="Ask"]');
      if (!ta) return 'no-textarea';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, ${JSON.stringify(prompt)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return 'typed';
    })()`;

  const send = () => `
    (() => {
      const btn = document.querySelector('button[aria-label="Send prompt"]');
      if (!btn) return 'no-button';
      btn.click();
      return 'sent';
    })()`;

  const tokenMeter = () => cdp.evaluate(`${DOC}.match(/([0-9.]+k?) \\/ 200k/)?.[1] ?? '0'`);

  /* ---------------------------------------------------------------- dashboard */
  await goto('/');
  check('dashboard renders', (await text()).includes('Two rounds, one 200,000 token budget.'));
  check('reset token control present', (await cdp.evaluate(clickByText('Reset token budget'))) !== 'not-found');
  check('budget shows the full 200k', (await text()).includes('200k'));

  /* ---------------------------------------------------------------- stack picker */
  await cdp.evaluate(clickByText('Start a mock test'));
  await sleep(700);
  const picker = await text();
  check('stack selection opens', picker.includes('Framework / stack'));
  check('frameworks offered', picker.includes('React + Node.js') && picker.includes('React + Spring Boot'));
  check('unavailable stack is explained', picker.includes('assessment only'));
  check('clock choice offered', picker.includes('Untimed') && picker.includes('Timed'));

  await cdp.evaluate(clickByText('Begin untimed'));
  await sleep(1800);
  check('begins in the arena untimed', (await text()).includes('Untimed practice'));

  /* ---------------------------------------------------------------- questions */
  await goto('/questions');
  const questionsText = await text();
  check('question bank renders', questionsText.includes('Question Bank'));
  check(
    '10 debugging questions',
    questionsText.includes('10/10 questions') || /Debugging[\s\S]{0,40}10\/10/.test(questionsText),
  );
  check('random picker present', (await cdp.evaluate(clickByText('Random'))) !== 'not-found');
  await sleep(400);
  check('random pick rendered', (await text()).includes('picked at random'));
  check('both timed and untimed entries offered', (await text()).includes('Untimed'));

  /* ---------------------------------------------------------------- arena A */
  await goto('/arena/A');
  const arenaText = await text();
  check('arena A mounts', arenaText.includes('vinyl-music'));
  check('explorer lists files', arenaText.includes('libraryService.js'));
  check('timer is opt-in', arenaText.includes('Untimed practice'));
  check('start timer offered', (await cdp.evaluate(clickByText('Start timer'))) !== 'not-found');
  check('editor is usable before the timer starts', (await cdp.evaluate(clickByText('Run Test Cases'))) !== 'not-found');

  await cdp.evaluate(clickByText('Start timer'));
  await sleep(900);
  const timerText = await cdp.evaluate(`${DOC}.match(/[0-9]{1,2}:[0-9]{2}/)?.[0] ?? 'NO-TIMER'`);
  check('timer counts down from 45:00', /^4[45]:\d\d$/.test(timerText), timerText);

  /* ---------------------------------------------------------------- suite */
  await cdp.evaluate(clickByText('Run Test Cases'));
  await sleep(8000);
  const afterRun = await text();
  check('six assertions graded', /\b6\/6\b|\b[0-5]\/6\b/.test(afterRun), 'score reported');
  check('failures carry a hint', afterRun.includes('Expected') || afterRun.includes('rounding'));

  /* ---------------------------------------------------------------- tutor mode */
  await cdp.evaluate(clickByText('Assistant'));
  await sleep(500);

  const meterBefore = await tokenMeter();
  check('prompt accepted', (await cdp.evaluate(ask('which files have errors?'))) === 'typed');
  await sleep(250);
  await cdp.evaluate(send());
  await sleep(2200);

  const afterLocate = await text();
  check('locate answer lists file paths', afterLocate.includes('Files that still need work'));
  check('paths are actionable', afterLocate.includes('failing') || afterLocate.includes('open'));
  check('token meter advanced', (await tokenMeter()) !== meterBefore, `${meterBefore} -> ${await tokenMeter()}`);

  await cdp.evaluate(ask('fix the error for me'));
  await sleep(250);
  await cdp.evaluate(send());
  await sleep(2200);

  const afterFix = await text();
  check('fix request is refused', afterFix.includes('not going to make that change'));
  check('refusal redirects to navigation', afterFix.includes('which files have errors'));

  const applyButtons = await cdp.evaluate(`
    [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Apply').length
  `);
  check('assistant never offers to apply an edit', applyButtons === 0, `${applyButtons} apply buttons`);

  await cdp.evaluate(ask('how are the routes connected?'));
  await sleep(250);
  await cdp.evaluate(send());
  await sleep(2200);
  const afterWiring = await text();
  check(
    'assistant explains the wiring',
    afterWiring.includes('How a request travels') && afterWiring.includes('/api/tracks'),
    'request flow diagram',
  );

  await cdp.evaluate(ask('what does ?? do in javascript?'));
  await sleep(250);
  await cdp.evaluate(send());
  await sleep(2200);
  check('assistant explains syntax', (await text()).includes('Syntax lookup'));

  /* ---------------------------------------------------------------- reset token */
  await goto('/');
  const beforeReset = await tokenMeter();
  await cdp.evaluate(clickByText('Reset token budget'));
  await sleep(800);
  const afterReset = await tokenMeter();
  check(
    'RESET TOKEN restores the full budget',
    beforeReset !== '0' && afterReset === '0',
    `${beforeReset} -> ${afterReset}`,
  );

  /* ---------------------------------------------------------------- open a question */
  await goto('/questions');
  await cdp.evaluate(clickByText('Random'));
  await sleep(400);
  await cdp.evaluate(clickByText('Untimed'));
  await sleep(1600);
  const inArena = await text();
  check(
    'question opens in the arena',
    /D-\d\d|F-\d\d/.test(inArena) && inArena.includes('Hint 1 of'),
    inArena.match(/Hint 1 of \d/)?.[0] ?? 'no hint control',
  );

  /* ---------------------------------------------------------------- round B */
  await goto('/arena/B');
  const arenaB = await text();
  check('arena B mounts', arenaB.includes('cinevault-web'));
  await cdp.evaluate(clickByText('Brief'));
  await sleep(500);
  check('requirements render', (await text()).includes('EPIC-231'));

  /* ---------------------------------------------------------------- analytics */
  await goto('/analytics');
  const analytics = await text();
  check('analytics records the run', analytics.includes('Run history'));
  check('mastery listed', analytics.includes('assertion mastery'));

  /* ---------------------------------------------------------------- errors */
  const realErrors = cdp.consoleErrors.filter(
    (e) => typeof e === 'string' && !/favicon|React DevTools/i.test(e),
  );
  check('no uncaught runtime errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  ws.close();
}

main()
  .then(() => {
    console.log(failures.length === 0 ? '\nAll e2e checks passed.' : `\n${failures.length} check(s) failed.`);
    cleanup();
    process.exit(failures.length === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('e2e run failed:', err);
    cleanup();
    process.exit(1);
  });
