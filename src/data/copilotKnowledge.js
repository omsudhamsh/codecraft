/**
 * The Copilot's knowledge base.
 *
 * Two rules shape this file:
 *
 * 1. **It points, it does not patch.** There is deliberately no `patches` array anywhere.
 *    The assistant names files, quotes the failing assertion, and teaches rules — it never
 *    hands over the change that makes the test pass.
 *
 * 2. **Brief by default, full on request.** Every entry has a `brief` form capped at roughly
 *    a screen, and an optional `full` form with the code examples. A one-line question must
 *    not cost a page of prose, because the output tokens are billed against a 200k budget.
 */

export const INTENTS = [
  /* ------------------------------------------------------------------ navigation */
  {
    id: 'locate-errors',
    kind: 'navigation',
    title: 'Files that still need work',
    modes: ['A', 'B'],
    keywords: [
      'locate', 'find', 'which', 'where', 'files', 'file', 'error', 'errors', 'bug', 'bugs',
      'broken', 'failing', 'points', 'point', 'affected', 'wrong', 'start', 'begin',
    ],
    // Classifier only — the answer is composed from live repository state.
  },

  {
    id: 'project-map',
    kind: 'navigation',
    title: 'Repository map',
    modes: ['A', 'B'],
    keywords: ['structure', 'map', 'overview', 'tree', 'layout', 'architecture', 'files', 'folder'],
    // Classifier only.
  },

  {
    id: 'c-wiring',
    kind: 'navigation',
    title: 'Request path',
    modes: ['A', 'B'],
    keywords: [
      'connected', 'connect', 'connection', 'wiring', 'call flow', 'request flow', 'trace',
      'which route', 'route map', 'endpoints', 'data flow', 'journey', 'chain',
    ],
    // Classifier only — the flow is composed per repository.
  },

  /* ------------------------------------------------------------------ boundary */
  {
    id: 'refuse-fix',
    kind: 'boundary',
    title: 'I can point, not patch',
    modes: ['A', 'B'],
    keywords: [
      'fix', 'fix it', 'fix the error', 'fix the bug', 'repair', 'solve', 'solve it',
      'resolve', 'correct it', 'patch', 'make it work', 'implement it for me',
      'write the code', 'give me the code', 'give me the answer', 'do it for me',
      'complete the task', 'just tell me what to change', 'solution',
    ],
    // Classifier only.
  },

  /* ------------------------------------------------------------------ concepts
     `brief` is what a normal question gets: a handful of rules, no code.
     `full` is opt-in via "in detail" / "more" / "explain fully", and is deliberately
     several times longer — that is the trade the candidate makes with their budget. */

  {
    id: 'c-syntax',
    kind: 'concept',
    title: 'JavaScript syntax',
    modes: ['A', 'B'],
    keywords: [
      'syntax', 'javascript', 'js', 'expression', 'keyword', 'what does', 'explain this',
      'operator', 'arrow', 'async await', 'destructuring', 'spread', 'optional chaining',
      'nullish', 'template literal', 'closure', 'hoisting', '=>', '??', '...', 'await',
    ],
    brief:
      'Name the construct and I will explain it. The ones that bite in review:\n\n' +
      '- `??` falls back only on `null`/`undefined`; `||` also falls back on `0` and `""`.\n' +
      '- `?.` short-circuits on nullish only.\n' +
      '- `await` inside `try` is what makes a rejection catchable.\n' +
      '- `splice(-1, 1)` deletes the **last** element, not nothing.\n' +
      '- A function\'s arity is how Express recognises an error handler.\n\n' +
      'Say **in detail** for the lookup table.',
    full:
      '### Syntax lookup\n\n' +
      '| Construct | What it does | Gotcha |\n' +
      '| --- | --- | --- |\n' +
      '| `(req, res, next) => {}` | a handler | arity decides whether Express sees an error layer |\n' +
      '| `await fn()` | unwraps a promise | must sit inside `try` or the rejection escapes |\n' +
      '| `a ?? b` | nullish coalescing | `0` and `""` pass through, unlike `\\|\\|` |\n' +
      '| `a?.b?.c` | optional chaining | short-circuits on nullish, not on falsy |\n' +
      '| `[...arr]`, `{ ...o }` | shallow copy | nested values still shared by reference |\n' +
      '| `const { a } = o` | destructuring | snapshots properties at that moment |\n' +
      '| `arr.filter(x => c)` | new array | never mutates |\n' +
      '| `arr.splice(i, 1)` | **mutates** | `splice(-1, 1)` deletes the last element |\n' +
      '| `res.status(204).end()` | no-body response | 204 must not carry a body |\n' +
      '| `try {} catch {}` | synchronous errors | an awaited rejection needs `await` inside |\n' +
      '| `` `a${b}` `` | template literal | evaluates `b` inline |\n' +
      '| `x ??= y` | logical assignment | assigns only when nullish |\n\n' +
      '**Worked example**\n\n' +
      '```js\n' +
      '// reads fine, does not do what the name promises\n' +
      'function removeFromLibrary(userId, trackId) {\n' +
      '  const index = db.library.findIndex((row) => row.trackId === trackId);\n' +
      '  db.library.splice(index, 1);        // index === -1 removes the LAST row\n' +
      '  if (index === -1) {\n' +
      '    throw new Error("not in this library");   // too late, already mutated\n' +
      '  }\n' +
      '}\n' +
      '```\n\n' +
      'Guard **before** you mutate, not after:\n\n' +
      '```js\n' +
      'const index = db.library.findIndex((row) => row.trackId === trackId);\n' +
      'if (index === -1) throw new Error("not in this library");\n' +
      'db.library.splice(index, 1);\n' +
      '```\n\n' +
      'Give me an exact expression and I will walk it line by line.',
  },

  {
    id: 'c-async',
    kind: 'concept',
    title: 'Async errors and rejections',
    modes: ['A', 'B'],
    keywords: [
      'promise', 'async', 'await', 'then', 'catch', 'finally', 'rejection', 'unhandled',
      'error', 'throw', 'try', 'catch block', 'hang', 'stuck', 'spinner',
    ],
    brief:
      'An `async` function never throws to its caller — it returns a **rejected promise**, ' +
      'and Express 4 does not watch for those, so the request hangs.\n\n' +
      '- `async` route handler → needs `try/catch`, or a `next(err)` somewhere.\n' +
      '- `.then()` chain → ends in `.catch()`, or you `await` inside `try`.\n' +
      '- Loading flags → cleared in `finally`, so the error path cannot strand a spinner.\n\n' +
      'Say **in detail** for before/after.',
    full:
      '### How the rejection escapes\n\n' +
      '```js\n' +
      '// the request never gets a response\n' +
      'router.post("/:id/notes", (req, res) => {\n' +
      '  service.findById(req.params.id).then((p) => res.status(201).json(p));\n' +
      '});\n' +
      '```\n\n' +
      '```js\n' +
      '// the caller now owns the rejection\n' +
      'router.delete("/:id", async (req, res, next) => {\n' +
      '  try {\n' +
      '    await service.removeFromLibrary(req.user.id, req.params.id);\n' +
      '    res.status(204).end();\n' +
      '  } catch (err) {\n' +
      '    if (/not in this library/i.test(err.message)) {\n' +
      '      return res.status(404).json({ error: err.message, code: "NOT_FOUND" });\n' +
      '    }\n' +
      '    next(err);\n' +
      '  }\n' +
      '});\n' +
      '```\n\n' +
      '**Checklist**\n\n' +
      '- Every `async` handler either catches, or forwards with `next(err)`.\n' +
      '- Every `.then()` chain has a terminal `.catch()`.\n' +
      '- A rejection you deliberately ignore is written `void p()` with a reason next to it.\n' +
      '- Spinner/loading cleared in `finally`, never only in the success branch.\n\n' +
      '**Client side**: `response.ok` is checked *before* `response.json()` — a 500 body parses ' +
      'fine and hides the failure behind an `undefined`.',
  },

  {
    id: 'c-express',
    kind: 'concept',
    title: 'Express routing and middleware',
    modes: ['A', 'B'],
    keywords: [
      'express', 'middleware', 'next', 'route', 'router', 'status', '404', '500',
      'error handler', 'app.use', 'mount', 'header', 'authorization', '401',
    ],
    brief:
      'Every layer must **respond**, call **`next()`**, or **throw**. Returning does none of those.\n\n' +
      '- `req.headers.Authorization` is always `undefined` — Node lower-cases header names.\n' +
      '- `app.use("/api", mw)` matches `/api` **and everything under it**.\n' +
      '- A four-parameter `(err, req, res, next)` layer is the error handler. Register it last.\n' +
      '- 401 unknown · 403 refused · 404 no such resource.\n\n' +
      'Say **in detail** for a worked middleware.',
    full:
      '```js\n' +
      'function authenticate(req, res, next) {\n' +
      '  const header = req.headers.authorization;      // lower-case, always\n' +
      '  const [scheme, token] = (header || "").split(" ");\n\n' +
      '  if (!token || scheme !== "Bearer") {\n' +
      '    return res.status(401).json({ error: "Unauthorized" });\n' +
      '  }\n\n' +
      '  const user = lookup(token);\n' +
      '  if (!user) return res.status(401).json({ error: "Unauthorized" });\n\n' +
      '  req.user = user;\n' +
      '  return next();                                 // without this, the route never runs\n' +
      '}\n' +
      '```\n\n' +
      '**Terminal layer, after the routers**\n\n' +
      '```js\n' +
      'app.use((req, res) => res.status(404).json({ error: "Not found" }));\n' +
      'app.use((err, req, res, next) => {            // four params = error layer\n' +
      '  res.status(err.status || 500).json({ error: err.message, code: err.code });\n' +
      '});\n' +
      '```\n\n' +
      '**Ordering traps**\n\n' +
      '- `/users/me` must be registered before `/users/:id`, or `me` is read as an id.\n' +
      '- `app.get("/api")` is an exact path; `app.use("/api", mw)` is a prefix.\n' +
      '- `next(err)` skips every non-error layer until it reaches the four-arity one.\n' +
      '- After `res.json()`, returning is fine; calling `next()` afterwards double-sends.',
  },

  {
    id: 'c-authz',
    kind: 'concept',
    title: 'Authentication vs authorisation',
    modes: ['B'],
    keywords: [
      'auth', 'authentication', 'authorisation', 'authorization', 'rbac', 'role',
      'permission', '403', '401', 'jwt', 'token', 'session', 'scope', 'ownership', 'login',
    ],
    brief:
      '- **401** — we do not know who you are.\n' +
      '- **403** — we do know, and the answer is no.\n\n' +
      'Collapsing them is a real bug: clients retry on 401 and error on 403, so a merged ' +
      'status makes the UI retry forever.\n\n' +
      'Order: `authenticate` (401) then `authorize(...roles)` (403). Anything resource-specific ' +
      '— "only the owner may edit this" — belongs in the service, after the row is loaded.\n\n' +
      'Say **in detail** for the guard and the scope predicate.',
    full:
      '```js\n' +
      'function authorize(...roles) {\n' +
      '  const allowed = roles.flat();\n' +
      '  return function guard(req, res, next) {\n' +
      '    if (!req.user) return next(unauthorized());\n' +
      '    if (allowed.includes(req.user.role)) return next();\n' +
      '    return next(forbidden("Role cannot perform this action"));\n' +
      '  };\n' +
      '}\n' +
      '```\n\n' +
      '```js\n' +
      '// route: identity, then policy\n' +
      'app.use("/api/awards", authenticate, awardRoutes);\n' +
      'router.post("/:movieId", authorize("curator", "admin"), handler);\n' +
      '```\n\n' +
      '```js\n' +
      '// service: scoping, applied before filtering and pagination\n' +
      'const visible = (user) => (task) =>\n' +
      '  user.role === "admin" ? true\n' +
      '  : user.role === "curator" ? task.orgId === user.orgId\n' +
      '  : task.ownerId === user.id;\n' +
      '```\n\n' +
      'Scope **first**: filter after and `meta.total` only counts what the caller may see; ' +
      'paginate first and the count leaks the size of the whole table.\n\n' +
      'Login must not enumerate accounts — the same 401 message for a wrong password and an ' +
      'unknown email.',
  },

  {
    id: 'c-react',
    kind: 'concept',
    title: 'React state, effects and props',
    modes: ['A', 'B'],
    keywords: [
      'react', 'hook', 'hooks', 'useeffect', 'usestate', 'usememo', 'dependency', 'dependencies',
      'deps', 'stale', 'closure', 'render', 'props', 'immutable', 'mutate', 'memo', 'cleanup',
      'unmount', 'strictmode', 'splice', 'push',
    ],
    brief:
      'Four rules cover most React bugs:\n\n' +
      '1. **Deps are a contract** — anything the callback reads that can change belongs in the array.\n' +
      '2. **Effects that outlive a render return a cleanup**, or StrictMode warns you.\n' +
      '3. **Props are immutable** — `items.push(x)` mutates the parent; React compares ' +
      'references, sees no change, and skips the render.\n' +
      '4. **Memoise only expensive derivations**, always with real deps.\n\n' +
      'Say **in detail** for the effect skeleton.',
    full:
      '```js\n' +
      'useEffect(() => {\n' +
      '  let active = true;\n' +
      '  (async () => {\n' +
      '    try {\n' +
      '      const rows = await load(page);      // page is read here…\n' +
      '      if (active) setRows(rows);\n' +
      '    } catch (err) {\n' +
      '      if (active) setError(err);\n' +
      '    } finally {\n' +
      '      if (active) setLoading(false);      // error path clears the spinner too\n' +
      '    }\n' +
      '  })();\n\n' +
      '  return () => { active = false; };      // …so page belongs in the deps\n' +
      '}, [page]);\n' +
      '```\n\n' +
      '```js\n' +
      '// wrong: mutates the prop the parent owns\n' +
      'function handleDelete() {\n' +
      '  tracks.splice(index, 1);\n' +
      '  onDelete(track.id);\n' +
      '}\n\n' +
      '// right: derive a new array, or ask the owner\n' +
      'const next = tracks.filter((t) => t.id !== track.id);\n' +
      'onDelete(track.id, next);\n' +
      '```\n\n' +
      '```js\n' +
      'const subtotal = useMemo(() => {\n' +
      '  return items.reduce((acc, i) => acc + i.price * i.qty, 0);\n' +
      '}, [items]);                              // real deps, or you bought a stale value\n' +
      '```\n\n' +
      '**Checklist**: deps declared · cleanup returned · loading cleared in `finally` · no ' +
      'in-place mutation of props or state.',
  },

  {
    id: 'c-money',
    kind: 'concept',
    title: 'Numbers, money and boundaries',
    modes: ['A'],
    keywords: [
      'money', 'price', 'currency', 'rounding', 'round', 'float', 'floating point', 'decimal',
      'total', 'tax', 'discount', 'coupon', 'nan', 'number', 'pagination', 'slice',
      'off by one', 'index', 'limit', 'offset',
    ],
    brief:
      '- `0.1 + 0.2 === 0.30000000000000004`. Round **once**, where the value leaves your domain: ' +
      '`Math.round((v + Number.EPSILON) * 100) / 100`.\n' +
      '- `slice(start, end)` — **`end` is exclusive**. Page 1 of size 3 over 10 items must give ' +
      '`[1,2,3]`.\n' +
      '- `Number.isFinite(parseFloat(x))` is the guard that stops `"abc"` rendering as `NaN`.\n' +
      '- User input is hostile: default the query, clamp the limit, decide what "empty" means.\n\n' +
      'Say **in detail** for the helpers.',
    full:
      '```js\n' +
      'const TAX_RATE = 0.0825;\n\n' +
      'const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;\n\n' +
      'function calculateTotal(items) {\n' +
      '  const safeItems = Array.isArray(items) ? items : [];   // a cleared cart must not throw\n' +
      '  const subtotal = safeItems.reduce((acc, i) => acc + i.price * i.qty, 0);\n' +
      '  return round(subtotal * 0.9 * (1 + TAX_RATE));\n' +
      '}\n' +
      '```\n\n' +
      '```js\n' +
      'function paginate(rows, page, limit) {\n' +
      '  const current = Math.max(1, Number(page) || 1);\n' +
      '  const size = Math.max(1, Number(limit) || 10);\n' +
      '  const start = (current - 1) * size;\n' +
      '  return rows.slice(start, start + size);      // end is exclusive — no "- 1"\n' +
      '}\n' +
      '```\n\n' +
      '```js\n' +
      'function formatMoney(value, currency = "USD") {\n' +
      '  const amount = Number.parseFloat(value);\n' +
      '  const safe = Number.isFinite(amount) ? amount : 0;\n' +
      '  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(safe);\n' +
      '}\n' +
      '```\n\n' +
      '**Checklist**: round once at the boundary · guard the empty case · clamp `limit` · ' +
      'coupon `percent` divides by 100 · no stray padding whitespace in a formatter.',
  },

  {
    id: 'c-testing',
    kind: 'concept',
    title: 'Reading a failing assertion',
    modes: ['A', 'B'],
    keywords: [
      'test', 'tests', 'assertion', 'failing', 'failed', 'failure', 'debug', 'read',
      'stack', 'trace', 'how to start', 'approach', 'stuck', 'method', 'help',
    ],
    brief:
      'Each assertion reads: *name · file · expectation*.\n\n' +
      '1. Say in one sentence what the code must do.\n' +
      '2. Open the file it names; read it top to bottom before editing.\n' +
      '3. Smallest change that satisfies the expectation.\n' +
      '4. Re-run. Still failing means your mental model is wrong, not your syntax.\n\n' +
      'The expected/received pair is the fastest clue in the tool.\n\n' +
      'Say **in detail** for the three assertion styles.',
    full:
      '**Three styles, three different skills**\n\n' +
      '- *structural* — the source is parsed. Is the check there at all?\n' +
      '- *behavioural* — the module executes. Your reasoning about values is wrong.\n' +
      '- *integration* — the whole request path runs. The bug is between layers.\n\n' +
      '**A reliable loop**\n\n' +
      '1. Read the failing assertion and restate it as a sentence about behaviour.\n' +
      '2. Open the named file. Read the whole thing — bugs hide in the lines above the change.\n' +
      '3. Make the smallest change that satisfies the expectation, not the one that would ' +
      'satisfy a reviewer.\n' +
      '4. Re-run. Same assertion still red means step 1 was wrong, not step 3.\n\n' +
      '**When an integration assertion fails**, walk the chain: client → fetch wrapper → route → ' +
      'middleware → service → store. Ask me "how are the routes connected" and I will draw it ' +
      'with the broken link marked.',
  },

  /* ------------------------------------------------------------------ process */
  {
    id: 'budget-tips',
    kind: 'process',
    title: 'Spending the budget',
    modes: ['A', 'B'],
    keywords: [
      'budget', 'token', 'tokens', 'cost', 'expensive', 'limit', 'strategy', 'tips',
      'advice', 'exhausted', 'ran out', 'why so much', 'less tokens',
    ],
    brief:
      'Per turn: system prompt ~1.2k · context ~0.5k per file I open · your message ~1 token ' +
      'per 4 characters · my answer (usually the biggest term).\n\n' +
      '- Cheap: *"which files have errors"* — usually ends your search immediately.\n' +
      '- Cheap: *"401 vs 403"* — unblocks several assertions at once.\n' +
      '- Expensive: *"review everything"* — I pull many files and write many paragraphs.\n\n' +
      'I answer briefly by default. Say **"in detail"** only when you want the long version — ' +
      'that is what costs you.',
  },
];

export const SUGGESTED_PROMPTS = {
  A: [
    'which files have errors?',
    'how are the routes connected?',
    'what does splice do?',
    'where do i start?',
  ],
  B: [
    'which files have errors?',
    '401 vs 403?',
    'what does next() do?',
    'where do i start?',
  ],
};

export const STARTUP_TIPS = [
  'Open a question and I answer for that question only.',
  'I answer in a few lines. Say "in detail" when you want more.',
  'I point at files and quote the assertion — I never make the edit for you.',
];
