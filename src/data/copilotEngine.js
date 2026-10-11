/**
 * Copilot retrieval + answer composition.
 *
 * There is no network call here. The assistant answers from a curated concept set,
 * scored against the candidate's prompt and the live state of their repository.
 *
 * Three routing rules, in priority order:
 *   1. "where / which files"        → navigation answer with clickable paths
 *   2. "fix it / solve it for me"   → boundary answer, redirected to (1) or a concept
 *   3. anything else                → the best-scoring concept
 */

import { INTENTS } from './copilotKnowledge.js';
import { scanDefects, fixedCount } from './defects.js';
import { computeTurnCost } from '../lib/tokens.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'and', 'or',
  'it', 'this', 'that', 'with', 'me', 'my', 'i', 'you', 'please', 'can', 'could', 'would',
  'should', 'do', 'does', 'did', 'how', 'what', 'why', 'when', 'where', 'which', 'be',
  'have', 'has', 'had', 'not', 'but', 'so', 'if', 'we', 'us', 'there', 'here', 'about',
  'get', 'got', 'give', 'need', 'want', 'know', 'think', 'like', 'just', 'also',
]);

const FIX_REQUEST =
  /\b(fix|fixes|fixed|fixing|repair|repaired|resolve|resolves|solved|solving|correct|patch|patches|debug it|write the (code|fix|file)|give me the (code|answer|fix|solution)|do it for me|implement (it|this) for me|make it work|complete the (task|story|feature)|just tell me what to change|show me the (fix|solution|answer))\b/i;

const LOCATE_REQUEST =
  /\b(which|what)\s+(files?|ones?)|where\s+(is|are|do|does)|locate|find\s+(the\s+)?(files?|bugs?|errors?|problems?|issues?)|affected files?|points? at|help me start|where do i start|list the files\b/i;

const MAP_REQUEST =
  /\b(repo\s?map|project\s?map|repository\s?map|file\s?structure|project\s?structure|folder\s?structure|code\s?structure|show me the (repo|project|repository|files)|what files (are|does)|overview of the (repo|project))\b/i;

const WIRING_REQUEST =
  /\b(how (are|do) (the )?(files?|routes?) (are )?connected|connected|connection|wiring|call flow|request flow|data flow|architecture|trace|which route|route map|endpoints?|imports? from|requires? what)\b/i;

function tokenizePrompt(prompt) {
  return String(prompt)
    .toLowerCase()
    .split(/[^a-z0-9$_.-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreConcept(intent, words) {
  let score = 0;
  for (const kw of intent.keywords) {
    const k = kw.toLowerCase();
    if (words.includes(k)) score += 4;
    else if (words.some((w) => w.length > 3 && (k.includes(w) || w.includes(k)))) score += 2;
  }
  return score;
}

function rankConcepts(prompt, limit = 2) {
  const words = tokenizePrompt(prompt);
  return INTENTS.filter((i) => i.kind === 'concept' || i.kind === 'process')
    .map((intent) => ({ intent, score: scoreConcept(intent, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ navigation */

function openProblems(mode, files, report) {
  const fromReport = [];
  if (report?.results?.length) {
    const grouped = new Map();
    for (const result of report.results) {
      if (result.status !== 'fail' || !result.file) continue;
      if (!grouped.has(result.file)) {
        grouped.set(result.file, { ids: [], titles: [], tests: [] });
      }
      const entry = grouped.get(result.file);
      entry.ids.push(result.id);
      entry.titles.push(result.title);
      entry.tests.push(result.question);
    }
    for (const [path, entry] of grouped) {
      fromReport.push({
        path,
        source: 'assertion',
        reason: entry.titles[0],
        detail: entry.ids.length > 1 ? `${entry.ids.join(', ')} are failing` : `${entry.ids[0]} is failing`,
        question: entry.tests.find(Boolean),
      });
    }
  }

  const fromScan = scanDefects(mode, files).map((defect) => ({
    path: defect.file,
    source: 'scan',
    reason: defect.summary,
    detail: defect.detail,
    question: defect.question,
  }));

  const merged = new Map();
  for (const item of [...fromReport, ...fromScan]) {
    const existing = merged.get(item.path);
    if (!existing) {
      merged.set(item.path, item);
    } else {
      existing.detail = [existing.detail, item.detail].filter(Boolean).join(' · ');
      existing.source = 'assertion+scan';
    }
  }

  return [...merged.values()].sort((a, b) => {
    const rank = { assertion: 0, 'assertion+scan': 1, scan: 2 };
    return rank[a.source] - rank[b.source] || a.path.localeCompare(b.path);
  });
}

function projectMap(mode) {
  if (mode === 'A') {
    return {
      repoName: 'vinyl-music',
      tree:
        '```\n' +
        'vinyl-music/                       the streaming service\n' +
        '├─ server/\n' +
        '│  ├─ index.js                     process entry\n' +
        '│  ├─ app.js                       middleware + route mounting\n' +
        '│  ├─ db.js                        users, tracks, library, playlists\n' +
        '│  ├─ middleware/auth.js           bearer-token authentication\n' +
        '│  ├─ routes/tracks.js             /api/tracks\n' +
        '│  ├─ routes/playlists.js          /api/playlists\n' +
        '│  ├─ services/libraryService.js   library reads and writes\n' +
        '│  └─ utils/duration.js            duration maths\n' +
        '├─ client/src/\n' +
        '│  ├─ api/client.js                fetch wrapper\n' +
        '│  ├─ hooks/useLibrary.js          loading + delete\n' +
        '│  ├─ components/TrackRow.jsx      one row, and the Delete button\n' +
        '│  ├─ components/PlaylistPanel.jsx sidebar\n' +
        '│  └─ utils/formatTime.js          mm:ss\n' +
        '└─ package.json\n' +
        '```',
      notes:
        '**Bug report:** deleting a track fails — the UI hangs, or the wrong row disappears, and the\n' +
        'track is still there after a refresh. Six files are involved in that one symptom.',
    };
  }

  return {
    repoName: 'cinevault-web',
    tree:
      '```\n' +
      'cinevault-web/                      the movie platform\n' +
      '├─ server/\n' +
      '│  ├─ index.js                     process entry\n' +
      '│  ├─ app.js                       middleware + route mounting\n' +
      '│  ├─ db.js                        movies, people, awards, users\n' +
      '│  ├─ middleware/authenticate.js   request pipeline (stub)\n' +
      '│  ├─ middleware/authorize.js      ← does not exist yet\n' +
      '│  ├─ routes/auth.js               POST /api/auth/login, GET /api/auth/me\n' +
      '│  ├─ routes/movies.js             /api/movies\n' +
      '│  ├─ routes/awards.js             /api/awards/:movieId (mock data)\n' +
      '│  ├─ services/movieService.js     catalogue access\n' +
      '│  ├─ services/awardService.js     award lookups — hard-coded\n' +
      '│  └─ utils/errors.js              typed HTTP errors\n' +
      '├─ client/src/\n' +
      '│  ├─ api/movies.js                fetch wrappers\n' +
      '│  ├─ context/AuthContext.jsx      session (stub)\n' +
      '│  ├─ pages/MovieDetail.jsx        movie page\n' +
      '│  ├─ pages/AwardsPage.jsx         awards & recognition\n' +
      '│  ├─ components/AwardCard.jsx     one award card\n' +
      '│  └─ utils/permissions.js         ← does not exist yet\n' +
      '└─ package.json\n' +
      '```',
    notes:
      '**Story:** the Awards & Recognition section is fed by `MOCK_AWARDS`. Seven real records already\n' +
      'sit in `db.awards`. Replace the mock, then put an account and a permission layer in front of it.',
  };
}

/** The request path for this repo — the thing people most often ask the assistant for. */
function requestFlow(mode) {
  if (mode === 'A') {
    return (
      'DELETE /api/tracks/:id          the bug you are chasing\n' +
      '  ↑\n' +
      'client/src/api/client.js         request() builds the fetch, deleteTrack() awaits it\n' +
      '  ↑\n' +
      'client/src/components/TrackRow.jsx      onClick → useLibrary.remove() → setTracks(...)\n' +
      '  ─────────────── network ───────────────\n' +
      'server/app.js                     app.use("/api/tracks", authenticate, trackRoutes)\n' +
      '  ↑\n' +
      'server/middleware/auth.js         authenticate → req.user\n' +
      '  ↑\n' +
      'server/routes/tracks.js           router.delete("/:id")\n' +
      '  ↑\n' +
      'server/services/libraryService.js removeFromLibrary(userId, trackId) → db.library.splice\n' +
      '  ↑\n' +
      'server/db.js                      users · tracks · library · playlists'
    );
  }

  return (
    'GET /api/awards/:movieId           the section you are rebuilding\n' +
    '  ↑\n' +
    'client/src/api/movies.js           listAwards() → { data }\n' +
    '  ↑\n' +
    'client/src/pages/AwardsPage.jsx    useEffect → setAwards(rows)\n' +
    '  ↑  passes movie.id down as movieId\n' +
    'client/src/pages/MovieDetail.jsx   the movie page\n' +
    '  ─────────────── network ───────────────\n' +
    'server/app.js                     app.use("/api/awards", awardRoutes)\n' +
    '  ↑\n' +
    'server/routes/awards.js            router.get("/:movieId")\n' +
    '  ↑\n' +
    'server/services/awardService.js    listForMovie() → MOCK_AWARDS   ← the break\n' +
    '  ↑\n' +
    'server/db.js                      movies · people · awards · users'
  );
}

/* ------------------------------------------------------------------ composition */

function renderLinks(links) {
  if (links.length === 0) {
    return '_No open problems detected in the current working tree._';
  }
  return links
    .map((link) => {
      const tag = link.source === 'assertion' ? 'failing assertion' : 'signature match';
      const question = link.question ? ` · question ${link.question}` : '';
      return (
        `- \`${link.path}\`  \n  ${link.detail}${question}  \n  _(${tag})_`
      );
    })
    .join('\n');
}

/**
 * @returns {{answer:string, title:string, kind:string, links:object[], cost:object, followUps:string[]}}
 */
export function answerPrompt({ prompt, mode, files, activeFile, report, history = [] }) {
  const wantsFix = FIX_REQUEST.test(prompt);
  const wantsLocate = LOCATE_REQUEST.test(prompt);
  const wantsMap = MAP_REQUEST.test(prompt);
  const wantsWiring = WIRING_REQUEST.test(prompt);

  const links = openProblems(mode, files, report);

  let answer;
  let kind;
  let title;
  let followUps;

  if (wantsLocate) {
    answer = renderNavigation(mode, files, links);
    kind = 'navigation';
    title = 'Files that still need work';
    followUps = [
      'How are the routes connected?',
      'Explain async/await and try/catch',
      'What is the difference between 401 and 403?',
    ];
  } else if (wantsMap || wantsWiring) {
    answer = wantsWiring ? renderWiring(mode, links) : renderMap(mode, links);
    kind = 'navigation';
    title = wantsWiring ? 'How the files and routes connect' : 'Repository map';
    followUps = ['Which files have errors?', 'How do I read a failing assertion?'];
  } else if (wantsFix) {
    answer = renderRefusal(links);
    kind = 'boundary';
    title = 'I can point, not patch';
    followUps = [
      'Which files have errors?',
      'Show me the repository map',
      'How do I read a failing assertion?',
    ];
  } else {
    const ranked = rankConcepts(prompt);
    const intent = ranked[0]?.intent ?? findIntent('c-testing');
    answer = intent.template;
    kind = intent.kind;
    title = intent.title;
    followUps = [
      'Which files have errors?',
      ...(ranked[1] ? [`Tell me about ${ranked[1].intent.title.toLowerCase()}`] : []),
      'How do I read a failing assertion?',
    ];
  }

  const orientationFile = mode === 'A' ? 'server/index.js' : 'server/app.js';
  const contextFiles = [
    activeFile,
    ...(kind === 'navigation' ? [orientationFile] : []),
    ...links.slice(0, 3).map((l) => l.path),
  ]
    .filter(Boolean)
    .filter((f) => Object.prototype.hasOwnProperty.call(files ?? {}, f));
  const uniqueContext = [...new Set(contextFiles)].slice(0, 4);

  const cost = computeTurnCost({
    prompt,
    contextFiles: uniqueContext,
    activeFile,
    output: answer,
  });

  return {
    answer,
    title,
    kind,
    links,
    contextFiles: uniqueContext,
    cost,
    followUps: followUps
      .filter((q) => !history.some((h) => h?.prompt?.slice(0, 24) === q.slice(0, 24)))
      .slice(0, 3),
  };
}

function findIntent(id) {
  return INTENTS.find((i) => i.id === id);
}

function renderMap(mode, links) {
  const map = projectMap(mode);
  const openNote = links.length
    ? `\n**${links.length} file${links.length === 1 ? '' : 's'} currently need work** — ask "which files have errors" for the clickable list.`
    : '\n**No open problems detected right now.**';

  return `### ${map.repoName}\n\n${map.tree}\n\n${map.notes}${openNote}\n\n> Ask "how are the routes connected" and I will draw the request path through this tree.`;
}

function renderWiring(mode, links) {
  const flow = requestFlow(mode);
  const broken = links.map((link) => `\`${link.path}\``).join(', ');
  const status = links.length
    ? `\n**Currently broken links:** ${broken}\n\n> Ask "which files have errors" for the full list with reasons.`
    : '\n**Every link in this path is currently healthy.**';

  const concept = findIntent('c-wiring');

  return concept.template.replace('{{FLOW}}', flow) + status;
}

function renderNavigation(mode, files, links) {
  const fixed = fixedCount(mode, files);
  const top = links[0];
  const topic = top ? top.path.split('/').pop().replace(/\.[jt]sx?$/, '') : 'this';

  const status = links.length
    ? `**${links.length} file${links.length === 1 ? '' : 's'} with open problems.** ` +
      `Start at \`${top.path}\` — ${top.detail.toLowerCase()}.\n\n` +
      (mode === 'B'
        ? '> Two of these files do not exist yet. Create them with the **New** button in the file explorer.'
        : '> Every one of these is a behaviour the suite asserts. Fix the behaviour, not the assertion.')
    : '**No open problems detected.** Run the suite to confirm, then read the passing assertions to see what they lock in.';

  return (
    `### Files that still need work\n\n` +
    `Click any path to open it in the editor.\n\n${renderLinks(links)}\n\n` +
    `${status}\n\n` +
    `> I will point you at the file, but I will not hand you the change — that is the part being assessed. ` +
    `Ask "explain ${topic}" and I will teach the concept behind it instead.`
  );
}

function renderRefusal(links) {
  const top = links[0];
  return (
    '### I am not going to make that change for you\n\n' +
    'That is the part of the round being measured. What I will do instead:\n\n' +
    '1. **Tell you where.** Ask *"which files have errors"* and I will list every file with an open problem, clickable.\n' +
    '2. **Show you the wiring.** Ask *"how are the routes connected"* and I will draw the whole request path, so you know which link is broken.\n' +
    '3. **Teach you the rule.** Ask *"explain async error handling"* or *"401 vs 403"* and I will give you the concept with a worked example that is not your code.\n\n' +
    (top
      ? `If you want a starting point rather than a solution: the file with the most open problems is \`${top.path}\`.`
      : 'Run the suite once and ask me again — the navigation answer is driven by real results.')
  );
}

export { projectMap };
