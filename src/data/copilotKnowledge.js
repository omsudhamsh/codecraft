/**
 * The Copilot's knowledge base.
 *
 * Deliberate design constraint: **this assistant teaches and navigates, it does not solve.**
 * It holds the complete file map of each repository and will tell you exactly which files
 * hold unresolved defects, but it will not hand you the fix. There is deliberately no
 * `patches` array anywhere in this file — an earlier build could apply edits, and that
 * turned the exercise into a copy-and-paste exercise.
 *
 * Every answer is either:
 *   - navigation  → "these files, these are the open problems"
 *   - concept     → general engineering knowledge, no reference to your defect
 *   - boundary    → a refusal that redirects to navigation or concept
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
      'broken', 'failing', 'points', 'point', 'affected', 'start', 'begin', 'wrong',
    ],
    priority: 100,
    // Classifier only — the navigation answer is composed from live repository state.
  },

  {
    id: 'project-map',
    kind: 'navigation',
    title: 'Repository map',
    modes: ['A', 'B'],
    keywords: [
      'structure', 'map', 'overview', 'files', 'folder', 'tree', 'layout', 'project',
      'repository', 'repo', 'codebase', 'what is this',
    ],
    priority: 60,
    // Classifier only — the map is composed in copilotEngine.projectMap.
  },

  /* ------------------------------------------------------------------ boundary */
  {
    id: 'refuse-fix',
    kind: 'boundary',
    title: 'I can point, not patch',
    modes: ['A', 'B'],
    priority: 95,
    keywords: [
      'fix', 'fix it', 'fix the error', 'fix the bug', 'repair', 'solve', 'solve it',
      'resolve', 'correct it', 'patch', 'make it work', 'implement it for me',
      'write the code', 'give me the code', 'give me the answer', 'do it for me',
      'complete the task', 'complete the story', 'just tell me what to change',
    ],
    // Classifier only — the refusal text is composed in copilotEngine.renderRefusal.
  },

  /* ------------------------------------------------------------------ concepts */
  {
    id: 'c-syntax',
    kind: 'concept',
    title: 'JavaScript syntax reference',
    modes: ['A', 'B'],
    keywords: [
      'syntax', 'what does', 'explain this', 'meaning of', 'operator', 'arrow',
      'async await', 'destructuring', 'spread', 'optional chaining', 'nullish',
      'template literal', 'shorthand', 'iife', 'closure', 'hoisting', 'prototype',
      'javascript', 'js', 'expression', 'keyword', 'language',
      '=>', '??', '...', 'async', 'await', 'try catch',
    ],
    template:
      '### Syntax lookup\n\n' +
      'Name the construct and I will explain it. The ones that come up most in a code review:\n\n' +
      '| Construct | What it does | Gotcha |\n' +
      '| --- | --- | --- |\n' +
      '| `(req, res, next) => {}` | a handler function | its **arity** is how Express tells an error layer from a normal one |\n' +
      '| `await fn()` | unwraps a promise | only inside `async`; a rejected one throws to the nearest `try` |\n' +
      '| `a ?? b` | nullish coalescing | unlike `\\|\\|`, `0` and `""` pass through |\n' +
      '| `a?.b?.c` | optional chaining | short-circuits on `null`/`undefined`, **not** on `0` or `""` |\n' +
      '| `[...arr]` / `{ ...obj }` | shallow copy | nested objects are still shared by reference |\n' +
      '| `{ id, trackId }` | destructuring | reads properties by name at that moment |\n' +
      '| `arr.filter(x => cond)` | new array, no mutation | returns truthy-filtered values |\n' +
      '| `arr.splice(i, 1)` | **mutates** | `splice(-1, 1)` removes the *last* element |\n' +
      '| `res.status(204).end()` | response with no body | 204 must not carry a body |\n' +
      '| `try { } catch { }` | synchronous errors only | an `await`ed rejection needs the `await` inside the `try` |\n\n' +
      'Say the exact expression and I will walk it line by line.',
  },

  {
    id: 'c-wiring',
    kind: 'concept',
    title: 'How the files and routes are connected',
    modes: ['A', 'B'],
    keywords: [
      'connected', 'connect', 'wiring', 'call flow', 'flow', 'request flow', 'architecture',
      'structure', 'how does', 'trace', 'where does', 'import', 'requires', 'dependency',
      'route map', 'endpoints', 'which route', 'data flow', 'journey',
    ],
    template:
      '### How a request travels through this codebase\n\n' +
      'The chain below is the one thing worth memorising before you change anything — a bug is\n' +
      'almost always a broken link in it.\n\n' +
      '```\n' +
      'component  →  api/client.js  →  HTTP route  →  middleware  →  service  →  db\n' +
      '   ↑                                                                        │\n' +
      '   └──────────────────────── setState ← response payload ───────────────┘\n' +
      '```\n\n' +
      '```\n' +
      '{{FLOW}}\n' +
      '```\n\n' +
      '**How to trace a bug in 30 seconds**\n\n' +
      '1. Find the failing route in the list below.\n' +
      '2. Read its middleware chain top to bottom — what runs before the handler?\n' +
      '3. Open the handler, note what it calls.\n' +
      '4. Open that module, note what it touches in the store.\n\n' +
      'Ask *"which files have errors"* and I will mark the links that are currently broken.',
  },

  {
    id: 'c-async',
    kind: 'concept',
    title: 'Async errors and unhandled rejections',
    modes: ['A', 'B'],
    keywords: [
      'promise', 'promises', 'async', 'await', 'then', 'catch', 'finally', 'rejection',
      'unhandled', 'error', 'throw', 'try', 'catch block',
    ],
    template:
      '### How async failures actually propagate\n\n' +
      '**The rule** — an `async` function never throws to its caller. It returns a *rejected promise*. ' +
      'Frameworks that only wrap the synchronous call (`try { handler() } catch`) will not see that rejection.\n\n' +
      '```js\n' +
      '// a rejected promise nobody is listening to\n' +
      'router.post("/:id/notes", (req, res) => {\n' +
      '  service.findById(req.params.id).then((product) => res.status(201).json(product));\n' +
      '});\n\n' +
      '// the caller now owns the rejection\n' +
      'router.post("/:id/notes", async (req, res, next) => {\n' +
      '  try {\n' +
      '    const product = await service.findById(req.params.id);\n' +
      '    res.status(201).json(product);\n' +
      '  } catch (err) {\n' +
      '    next(err);   // hand it somewhere on purpose\n' +
      '  }\n' +
      '});\n' +
      '```\n\n' +
      '**Checklist**\n\n' +
      '- Every `.then()` chain ends in `.catch()` — or you use `await` inside `try`.\n' +
      '- Loading/spinner flags are cleared in `finally`, so the error path cannot strand them.\n' +
      '- A rejection you deliberately ignore is written down as `void somePromise()` with a reason.\n' +
      '- On the client, `response.ok` is checked *before* `response.json()`: a 500 body parses fine and hides the failure.',
  },

  {
    id: 'c-express',
    kind: 'concept',
    title: 'Express routing and middleware',
    modes: ['A', 'B'],
    keywords: [
      'express', 'middleware', 'next', 'route', 'router', 'status', '404', '500',
      'error handler', 'app.use', 'mount',
    ],
    template:
      '### Middleware is a chain, and you choose where it stops\n\n' +
      'Express runs layers in registration order. Each layer must do exactly one of three things: ' +
      '**respond**, call **`next()`**, or **throw**. Returning from the function does none of them in a useful way.\n\n' +
      '```js\n' +
      'function authenticate(req, res, next) {\n' +
      '  const header = req.headers.authorization;       // Node lower-cases every header name\n' +
      '  const [scheme, token] = (header || "").split(" ");\n\n' +
      '  if (!token || scheme !== "Bearer") return res.status(401).json({ error: "Unauthorized" });\n\n' +
      '  const user = lookup(token);\n' +
      '  if (!user) return res.status(401).json({ error: "Unauthorized" });\n\n' +
      '  req.user = user;\n' +
      '  return next();                                  // nothing after this line runs otherwise\n' +
      '}\n' +
      '```\n\n' +
      '**Gotchas that cost an hour**\n\n' +
      '- `req.headers.Authorization` is always `undefined`. Use `req.headers.authorization` or `req.get("Authorization")`.\n' +
      '- `app.use("/api", mw)` matches `/api` **and everything under it**; `app.get("/api")` matches only that exact path.\n' +
      '- `:id` captures one path segment. Register `/users/me` before `/users/:id` or `me` is read as an id.\n' +
      '- A four-parameter layer `(err, req, res, next)` is the error handler. Register it last.\n\n' +
      '**Status vocabulary** — 400 the request is malformed · 401 we do not know who you are · ' +
      '403 we know, and the answer is no · 404 no such resource · 409 conflict · 500 we broke.',
  },

  {
    id: 'c-authz',
    kind: 'concept',
    title: 'Authentication vs authorisation',
    modes: ['B'],
    keywords: [
      'auth', 'authentication', 'authorisation', 'authorization', 'rbac', 'role',
      'permission', '403', '401', 'jwt', 'token', 'session', 'scope', 'ownership',
    ],
    template:
      '### Two different questions\n\n' +
      '| Question | Answer | Status |\n' +
      '| --- | --- | --- |\n' +
      '| Who are you? | no credential / bad credential | `401` |\n' +
      '| What may you do? | valid identity, insufficient rights | `403` |\n\n' +
      'Collapsing them is a real bug: clients retry on 401 and show an error on 403, so a merged status makes the UI retry forever.\n\n' +
      '**Layer them in this order**\n\n' +
      '```js\n' +
      'app.use("/api/tasks", authenticate, taskRoutes);   // 1. who are you\n' +
      'router.post("/", authorize("admin", "manager"), handler); // 2. what may you do\n' +
      '```\n\n' +
      'A role guard is coarse. Anything resource-specific ("only the owner may edit this task") belongs in the service, ' +
      'after the row is loaded, because that is the only place the ownership fact exists.\n\n' +
      '**Scoping a list** is a predicate, applied *before* filtering and pagination:\n\n' +
      '```js\n' +
      'const visible = (user) => (task) =>\n' +
      '  user.role === "admin"  ? true\n' +
      '  : user.role === "manager" ? task.teamId === user.teamId\n' +
      '  : task.ownerId === user.id || task.assigneeId === user.id;\n\n' +
      'const rows = allTasks.filter(visible(req.user)).filter(applyQuery).slice(start, start + limit);\n' +
      '```\n\n' +
      'Order matters: scope first means `meta.total` describes what the caller may see. ' +
      'Paginate first and the count leaks the size of the whole table.',
  },

  {
    id: 'c-react',
    kind: 'concept',
    title: 'React state, effects and props',
    modes: ['A', 'B'],
    keywords: [
      'react', 'hook', 'hooks', 'useeffect', 'useState', 'usememo', 'dependency',
      'dependencies', 'deps', 'stale', 'closure', 'render', 'props', 'immutable',
      'mutate', 'memo', 'cleanup', 'unmount', 'strictmode',
    ],
    template:
      '### The four rules that cover most React bugs\n\n' +
      '**1. The dependency array is a contract.** Anything the callback closes over that can change belongs in it. ' +
      '`useEffect(fn, [])` freezes the closure from the first render forever — that is what a "stale value" bug is.\n\n' +
      '```js\n' +
      'useEffect(() => {\n' +
      '  let active = true;\n' +
      '  (async () => {\n' +
      '    try {\n' +
      '      const rows = await load(page);   // page is read here…\n' +
      '      if (active) setRows(rows);\n' +
      '    } catch (err) {\n' +
      '      if (active) setError(err);\n' +
      '    } finally {\n' +
      '      if (active) setLoading(false);\n' +
      '    }\n' +
      '  })();\n\n' +
      '  return () => { active = false; };   // …so page belongs here\n' +
      '}, [page]);\n' +
      '```\n\n' +
      '**2. Effects that outlive a render return a cleanup.** Without it, StrictMode double-invokes will warn you and a real unmount will warn louder.\n\n' +
      '**3. Props are immutable.** `items.push(x)` mutates the parent\'s array in place. React compares references, ' +
      'sees no change, skips the re-render, and the parent\'s state is now silently corrupt. Derive instead:\n\n' +
      '```js\n' +
      'const next = items.concat([line]);   // or items.map(...)\n' +
      'onChange(next);\n' +
      '```\n\n' +
      '**4. Memoise only expensive derivations, and always pass real deps.** `useMemo` with a wrong or empty array ' +
      'trades a stale-value bug for a few microseconds of saved work — never worth it.',
  },

  {
    id: 'c-money',
    kind: 'concept',
    title: 'Money, numbers and boundaries',
    modes: ['A'],
    keywords: [
      'money', 'price', 'currency', 'rounding', 'round', 'float', 'floating point',
      'decimal', 'total', 'tax', 'discount', 'nan', 'number', 'number.isnan',
      'pagination', 'slice', 'off by one', 'index', 'limit', 'offset',
    ],
    template:
      '### Floating point is not decimal\n\n' +
      '`0.1 + 0.2 === 0.30000000000000004`. Multiply that by a tax rate and you get `97.42500000000001`, which is ' +
      '*correct arithmetic* and still fails an exact currency assertion.\n\n' +
      '```js\n' +
      'const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;\n' +
      '```\n\n' +
      '- Round **once**, at the boundary where the value leaves your domain — not on every intermediate step.\n' +
      '- For real money, store integer minor units (cents/paise) or use a decimal library.\n' +
      '- `Number.isFinite(parseFloat(x))` is the guard that stops `"abc"` rendering as `NaN` in the UI.\n\n' +
      '### Off-by-one in slices\n\n' +
      '`Array.prototype.slice(start, end)` — **`end` is exclusive**. Page 1 of size 3 over 10 items must give `[1,2,3]`; ' +
      'page 2 must give `[4,5,6]`. Write those three numbers on paper before you touch the arithmetic.\n\n' +
      '### Guard the edges\n\n' +
      'User input is hostile: a cleared cart, a missing search term, `limit=100000`. Default it, clamp it, and decide ' +
      'what an empty collection means before a user finds out for you.',
  },

  {
    id: 'c-testing',
    kind: 'concept',
    title: 'How to read a failing assertion',
    modes: ['A', 'B'],
    keywords: [
      'test', 'tests', 'assertion', 'failing', 'failed', 'failure', 'debug', 'read',
      'stack', 'trace', 'how to start', 'approach', 'method', 'stuck',
    ],
    template:
      '### Read the assertion before the code\n\n' +
      'Each one is written as: *name · file · expectation*. The title is the requirement in English, ' +
      'the file is where the behaviour lives, and the category tells you what kind of rule it is.\n\n' +
      '**A reliable loop**\n\n' +
      '1. Read the failing assertion and say, in one sentence, what the code must do.\n' +
      '2. Open the file it names. Read top to bottom before editing anything.\n' +
      '3. Make the smallest change that satisfies the expectation — not the change that would satisfy a code reviewer.\n' +
      '4. Re-run. If the same assertion still fails, your mental model of the code is wrong, not your syntax.\n\n' +
      '**Three assertion styles, three different skills**\n\n' +
      '- *structural* — read the source: is the check there at all?\n' +
      '- *behavioural* — the module runs; your reasoning about values is wrong.\n' +
      '- *integration* — the whole request path runs; the bug is between layers.\n\n' +
      'The expected/received pair in a failure is the fastest clue in the whole tool. Read it before the stack trace.',
  },

  /* ------------------------------------------------------------------ process */
  {
    id: 'budget-tips',
    kind: 'process',
    title: 'Spending the token budget',
    modes: ['A', 'B'],
    keywords: [
      'budget', 'token', 'tokens', 'cost', 'expensive', 'limit', 'strategy', 'tips',
      'advice', 'exhausted', 'ran out', 'help me use',
    ],
    template:
      '### What each prompt costs you\n\n' +
      '| Component | Typical cost |\n' +
      '| --- | --- |\n' +
      '| System prompt | ~1.2k tokens, every single turn |\n' +
      '| Repository context | ~0.5k per file I open, ~0.9k for the file you are editing |\n' +
      '| Your message | 1 token per 4 characters |\n' +
      '| My answer | the largest term — long answers are expensive |\n\n' +
      '**Cheap questions**\n\n' +
      '- *"which files have errors"* — cheap, and it usually ends your search immediately.\n' +
      '- *"explain 403 vs 401"* — cheap, and it unblocks you on five assertions at once.\n\n' +
      '**Expensive questions**\n\n' +
      '- *"review everything and tell me what is wrong"* — I pull many files and write many paragraphs.\n' +
      '- *"fix it"* — I decline, but you still pay for the system prompt and context.\n\n' +
      'At zero the assistant locks. A candidate who reads assertions carefully needs five or six good prompts; ' +
      'a candidate who guesses needs sixty.',
  },
];

export const SUGGESTED_PROMPTS = {
  A: [
    'Which files have errors?',
    'How are the routes connected?',
    'Explain async/await and try/catch',
    'What does ?? do?',
  ],
  B: [
    'Which files have errors?',
    'How are the routes connected?',
    'What is the difference between 401 and 403?',
    'Explain role-based access control',
  ],
};

export const STARTUP_TIPS = [
  'Ask which files have errors first - it is the cheapest prompt in the tool.',
  'Ask how the routes are connected - it turns a guess into a two-minute trace.',
  'Stuck on a line of code? Ask for the syntax, not the fix.',
  'The failing assertion names its own file. Read it before you prompt anything.',
];
