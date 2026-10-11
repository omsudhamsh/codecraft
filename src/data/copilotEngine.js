/**
 * Copilot routing and answer composition.
 *
 * The central idea is **scope**. Before answering anything, the engine resolves what the
 * candidate is actually working on, in priority order:
 *
 *   1. the open question      → its file, its assertion, its reported defect
 *   2. the last run            → the assertions currently failing
 *   3. a signature scan        → files whose known defect is still present
 *   4. the active file
 *
 * Every answer is built from that scope and the scope is echoed back to the candidate, so
 * a generic paragraph cannot masquerade as knowledge of their problem. That is the whole
 * defence against hallucination here: the assistant is not asked to recall the repo, it is
 * handed it.
 *
 * Answers are **brief by default**. `full` text exists but only ships when the candidate
 * asks for it, because output tokens are billed against a 200k budget.
 */

import { INTENTS } from './copilotKnowledge.js';
import { scanDefects, fixedCount, DEFECTS } from './defects.js';
import { findQuestion } from './questions.js';
import { computeTurnCost } from '../lib/tokens.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'and', 'or',
  'it', 'this', 'that', 'with', 'me', 'my', 'i', 'you', 'please', 'can', 'could', 'would',
  'should', 'do', 'does', 'did', 'how', 'what', 'why', 'when', 'where', 'which', 'be',
  'have', 'has', 'had', 'not', 'but', 'so', 'if', 'we', 'us', 'there', 'here', 'about',
  'get', 'got', 'give', 'need', 'want', 'know', 'think', 'like', 'just', 'also', 'more',
]);

const FIX_REQUEST =
  /\b(fix|fixes|fixed|fixing|repair|repaired|resolve|resolves|solved|solving|correct|patch|patches|debug it|write the (code|fix|file)|give me the (code|answer|fix|solution)|do it for me|implement (it|this) for me|make it work|complete the (task|story|feature)|just tell me what to change|solution)\b/i;

const LOCATE_REQUEST =
  /\b(which|what)\s+(files?|ones?)|where\s+(is|are|do|does)|locate|find\s+(the\s+)?(files?|bugs?|errors?|problems?|issues?)|affected files?|points? at|help me start|where do i start|list the files\b/i;

const MAP_REQUEST =
  /\b(repo\s?map|project\s?map|repository\s?map|file\s?structure|project\s?structure|folder\s?structure|code\s?structure|overview of the (repo|project))\b/i;

const WIRING_REQUEST =
  /\b(how (are|do) (the )?(files?|routes?) (are )?connected|connected|connection|wiring|call flow|request flow|data flow|trace|which route|route map|endpoints?)\b/i;

const DETAIL_REQUEST =
  /\b(in detail|detailed|detail|full|elaborate|expand|more on|explain (it )?fully|with (code|examples)|thoroughly|deep dive|walk me through)\b/i;

/**
 * Symbol-bearing tokens matter here: `??`, `=>` and `?.` are literally what people type
 * when they are stuck on syntax, so the tokenizer has to keep them. An earlier version
 * split on `[^a-z0-9...]` and silently deleted every operator, which made those
 * questions fall through to the generic fallback.
 */
function words(prompt) {
  return String(prompt)
    .toLowerCase()
    .split(/[^a-z0-9$?.<>=_-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/* ------------------------------------------------------------------ scope */

function failingFromReport(report) {
  if (!report?.results?.length) return [];
  const grouped = new Map();
  for (const result of report.results) {
    if (result.status !== 'fail' || !result.file) continue;
    if (!grouped.has(result.file)) {
      grouped.set(result.file, { path: result.file, ids: [], titles: [], tests: [] });
    }
    const entry = grouped.get(result.file);
    entry.ids.push(result.id);
    entry.titles.push(result.title);
    if (result.question) entry.tests.push(result.question);
  }
  return [...grouped.values()].map((e) => ({
    path: e.path,
    source: 'assertion',
    reason: e.titles[0],
    detail: e.ids.length > 1 ? `${e.ids.join(', ')} failing` : `${e.ids[0]} failing`,
    question: e.tests[0],
    ids: e.ids,
  }));
}

function openProblems(mode, files, report) {
  const fromScan = scanDefects(mode, files).map((defect) => ({
    path: defect.file,
    source: 'scan',
    reason: defect.summary,
    detail: defect.detail,
    question: defect.question,
    ids: [defect.test].filter(Boolean),
  }));

  const merged = new Map();
  for (const item of [...failingFromReport(report), ...fromScan]) {
    const existing = merged.get(item.path);
    if (!existing) merged.set(item.path, item);
    else existing.detail = [existing.detail, item.detail].filter(Boolean).join(' · ');
  }

  const rank = { assertion: 0, scan: 1 };
  return [...merged.values()].sort(
    (a, b) => rank[a.source] - rank[b.source] || a.path.localeCompare(b.path),
  );
}

/**
 * Everything the assistant is allowed to know about "what you are working on".
 * This is echoed to the candidate so they can see the assistant is not guessing.
 */
export function resolveScope({ mode, files, activeFile, report, questionId }) {
  const question = questionId ? findQuestion(mode, questionId) : null;
  const problems = openProblems(mode, files, report);
  const assertion = question?.test
    ? problems.find((p) => p.ids?.includes(question.test)) ?? null
    : null;

  const files_in_scope = [...new Set([
    ...(question ? [question.file] : []),
    ...(assertion ? [assertion.path] : []),
    ...problems.slice(0, 3).map((p) => p.path),
    ...(activeFile ? [activeFile] : []),
  ].filter(Boolean))];

  const defects = DEFECTS[mode] ?? [];
  const defect = question
    ? defects.find((d) => d.question === question.id) ?? null
    : null;

  return { question, assertion, problems, files: files_in_scope, defect };
}

/** The header block that grounds every answer. This is the anti-hallucination anchor. */
function scopeBlock(scope) {
  const { question, assertion, defect } = scope;
  if (!question) return '';

  const lines = [
    `**${question.id} · ${question.title}**`,
    `- Target file: \`${question.file}\``,
  ];
  if (assertion) lines.push(`- Assertion: **${assertion.ids.join(', ')}** — ${assertion.reason}`);
  if (defect) lines.push(`- Reported: ${defect.summary}`);
  if (question.test && !assertion) lines.push(`- Graded by: ${question.test}`);

  return `${lines.join('\n')}\n\n`;
}

/* ------------------------------------------------------------------ routing */

function rankConcepts(prompt, limit = 1) {
  const tokens = words(prompt);
  return INTENTS.filter((i) => i.kind === 'concept' || i.kind === 'process')
    .map((intent) => {
      let score = 0;
      for (const kw of intent.keywords) {
        const k = kw.toLowerCase();
        if (tokens.includes(k)) score += 4;
        else if (tokens.some((w) => w.length > 3 && (k.includes(w) || w.includes(k)))) score += 2;
      }
      return { intent, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const findIntent = (id) => INTENTS.find((i) => i.id === id);

/* ------------------------------------------------------------------ answers */

function renderLocate(scope, files) {
  const { problems, question } = scope;
  if (problems.length === 0) {
    return (
      (question ? scopeBlock(scope) : '') +
      '**No open problems detected.** Run the suite to confirm, then read the passing ' +
      'assertions to see what they lock in.'
    );
  }

  const top = problems[0];
  const list = problems
    .slice(0, 5)
    .map((p) => {
      const q = p.question ? ` · ${p.question}` : '';
      return `- \`${p.path}\` — ${p.detail}${q}`;
    })
    .join('\n');

  const status = `Start at \`${top.path}\` — ${top.detail}`;

  return (question ? scopeBlock(scope) : '') + `### Files with open problems\n\n${list}\n\n${status}`;
}

function renderMap(mode, scope) {
  const map = projectMap(mode);
  const open = scope.problems.length
    ? `\n${scope.problems.length} file(s) still need work — ask "which files have errors".`
    : '\nNo open problems detected.';
  return `### ${map.repoName}\n\n${map.tree}\n\n${map.blurb}${open}`;
}

function renderWiring(mode, scope) {
  const flow = requestFlow(mode);
  const broken = scope.problems.map((p) => `\`${p.path}\``).join(', ');
  const status = broken
    ? `\n**Broken links:** ${broken}`
    : '\n**Every link in this path is healthy.**';
  return `### Request path\n\n\`\`\`\n${flow}\n\`\`\`\n${status}`;
}

function renderRefusal(scope) {
  const top = scope.problems[0];
  const head = scope.question ? scopeBlock(scope) : '';
  return (
    `${head}I will not make that change for you — that is the part being assessed.\n\n` +
    '- **Where** — ask *"which files have errors"*.\n' +
    '- **How it flows** — ask *"how are the routes connected"*.\n' +
    '- **The rule** — ask *"401 vs 403"*, *"what does next() do"*, etc.\n\n' +
    (top ? `Start from \`${top.path}\`.` : 'Run the suite once and ask me again.')
  );
}

function renderConcept(intent, scope, detailed) {
  const body = detailed && intent.full ? intent.full : intent.brief;
  return scopeBlock(scope) + body;
}

/* ------------------------------------------------------------------ repo maps */

function projectMap(mode) {
  if (mode === 'A') {
    return {
      repoName: 'vinyl-music',
      blurb: 'Music streaming. Open ticket: deleting a track fails.',
      tree:
        '```\n' +
        'vinyl-music/\n' +
        '├─ server/\n' +
        '│  ├─ index.js  app.js  db.js\n' +
        '│  ├─ middleware/auth.js          bearer-token auth\n' +
        '│  ├─ routes/tracks.js            /api/tracks\n' +
        '│  ├─ routes/playlists.js         /api/playlists\n' +
        '│  ├─ services/libraryService.js  library read/write\n' +
        '│  └─ utils/duration.js\n' +
        '├─ client/src/\n' +
        '│  ├─ api/client.js               fetch wrapper\n' +
        '│  ├─ hooks/useLibrary.js         load + delete\n' +
        '│  ├─ components/TrackRow.jsx     row + Delete button\n' +
        '│  ├─ components/PlaylistPanel.jsx\n' +
        '│  └─ utils/formatTime.js\n' +
        '└─ package.json\n' +
        '```',
    };
  }
  return {
    repoName: 'cinevault-web',
    blurb: 'Movie platform. The Awards section is fed by mock data.',
    tree:
      '```\n' +
      'cinevault-web/\n' +
      '├─ server/\n' +
      '│  ├─ index.js  app.js  db.js\n' +
      '│  ├─ middleware/authenticate.js   request pipeline (stub)\n' +
      '│  ├─ middleware/authorize.js      ← does not exist yet\n' +
      '│  ├─ routes/auth.js               /api/auth/login\n' +
      '│  ├─ routes/movies.js             /api/movies\n' +
      '│  ├─ routes/awards.js             /api/awards/:movieId\n' +
      '│  ├─ services/movieService.js\n' +
      '│  ├─ services/awardService.js     ← mock data\n' +
      '│  └─ utils/errors.js              typed HTTP errors\n' +
      '├─ client/src/\n' +
      '│  ├─ api/movies.js\n' +
      '│  ├─ context/AuthContext.jsx      session (stub)\n' +
      '│  ├─ pages/MovieDetail.jsx  pages/AwardsPage.jsx\n' +
      '│  ├─ components/AwardCard.jsx\n' +
      '│  └─ utils/permissions.js         ← does not exist yet\n' +
      '└─ package.json\n' +
      '```',
  };
}

function requestFlow(mode) {
  if (mode === 'A') {
    return (
      'DELETE /api/tracks/:id\n' +
      '  client/src/components/TrackRow.jsx  → onDelete\n' +
      '  client/src/hooks/useLibrary.js     → remove() → setTracks\n' +
      '  client/src/api/client.js           → deleteTrack() → fetch\n' +
      '  ─────────── network ───────────\n' +
      '  server/app.js                      app.use("/api/tracks", authenticate, tracks)\n' +
      '  server/middleware/auth.js          authenticate → req.user\n' +
      '  server/routes/tracks.js            router.delete("/:id")\n' +
      '  server/services/libraryService.js  removeFromLibrary → db.library.splice\n' +
      '  server/db.js                       users · tracks · library'
    );
  }
  return (
    'GET /api/awards/:movieId\n' +
    '  client/src/pages/MovieDetail.jsx   passes movie.id down\n' +
    '  client/src/pages/AwardsPage.jsx    useEffect → setAwards\n' +
    '  client/src/api/movies.js           listAwards() → { data }\n' +
    '  ─────────── network ───────────\n' +
    '  server/app.js                      app.use("/api/awards", awards)\n' +
    '  server/routes/awards.js            router.get("/:movieId")\n' +
    '  server/services/awardService.js    listForMovie() → MOCK_AWARDS   ← the break\n' +
    '  server/db.js                       movies · people · awards · users'
  );
}

/* ------------------------------------------------------------------ entry point */

/**
 * @returns {{answer, title, kind, links, contextFiles, cost, followUps, scope}}
 */
export function answerPrompt({
  prompt,
  mode,
  files,
  activeFile,
  report,
  questionId,
  history = [],
}) {
  const scope = resolveScope({ mode, files, activeFile, report, questionId });
  const detailed = DETAIL_REQUEST.test(prompt);
  const wantsFix = FIX_REQUEST.test(prompt);
  const wantsLocate = LOCATE_REQUEST.test(prompt);
  const wantsMap = MAP_REQUEST.test(prompt);
  const wantsWiring = WIRING_REQUEST.test(prompt);

  // "in detail: what does ?? do" must still rank on "?? do" — otherwise the verbosity
  // modifier erases the topic and the answer silently drifts to a generic fallback.
  const topic = prompt
    .replace(/\b(in detail|detailed|detail|full|elaborate|expand|more on|explain fully|with code|with examples|thoroughly|deep dive|walk me through|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let answer;
  let kind;
  let title;
  let followUps;

  if (wantsFix) {
    answer = renderRefusal(scope);
    kind = 'boundary';
    title = 'I can point, not patch';
    followUps = ['which files have errors?', 'how are the routes connected?'];
  } else if (wantsLocate) {
    answer = renderLocate(scope, files);
    kind = 'navigation';
    title = 'Files that still need work';
    followUps = ['how are the routes connected?', 'where do i start?'];
  } else if (wantsMap) {
    answer = renderMap(mode, scope);
    kind = 'navigation';
    title = 'Repository map';
    followUps = ['which files have errors?'];
  } else if (wantsWiring) {
    answer = renderWiring(mode, scope);
    kind = 'navigation';
    title = 'Request path';
    followUps = ['which files have errors?'];
  } else {
    const ranked = rankConcepts(topic || prompt);
    const intent = ranked[0]?.intent ?? findIntent('c-testing');
    answer = renderConcept(intent, scope, detailed);
    kind = intent.kind;
    title = intent.title;
    followUps = detailed ? [] : ['which files have errors?', 'in detail'];
  }

  // Keep the re-sent context tight: the scoped file plus, at most, one other.
  const contextFiles = scope.files.slice(0, detailed ? 3 : 2);

  const cost = computeTurnCost({
    prompt,
    contextFiles,
    activeFile: scope.files.includes(activeFile) ? activeFile : null,
    output: answer,
  });

  return {
    answer,
    title,
    kind,
    detailed,
    links: scope.problems,
    scope: {
      questionId: scope.question?.id ?? null,
      questionTitle: scope.question?.title ?? null,
      questionFile: scope.question?.file ?? null,
      assertion: scope.assertion?.ids ?? [],
      defect: scope.defect?.summary ?? null,
      openFiles: scope.problems.length,
      fixedFiles: fixedCount(mode, files),
    },
    contextFiles,
    cost,
    followUps: followUps
      .filter((q) => !history.some((h) => h?.prompt?.slice(0, 24) === q.slice(0, 24)))
      .slice(0, 2),
  };
}

export { projectMap, requestFlow };
