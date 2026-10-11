# CodeCraft — CapEx-AI Practice Studio

A production-ready React simulation of the **Capgemini Exceller Round 2 AI-Assisted Full-Stack Coding
Assessment (13–16 LPA)**, modelled on tasks candidates have described from the real round.

Two independent rounds, two independent repositories, **six graded assertions each** — coupled only by
a shared **200,000-token AI budget** that is the real pressure of the exercise.

```bash
npm install
npm run dev          # http://localhost:5173
```

---

## What it simulates

| | Round 1 — Debugging | Round 2 — Feature Development |
| --- | --- | --- |
| App | **Vinyl** — a music-streaming service | **CineVault** — a movie platform |
| Scenario | Deleting a track fails: the UI hangs, or the wrong row disappears, and the track is back after a refresh | The Awards & Recognition section renders, but every card comes from a hard-coded mock array |
| Graded | **6 assertions**, easy to moderate | **6 assertions**, easy to moderate |
| Questions | 10 (D-01 … D-10) | 10 (F-01 … F-10) |
| Clock | optional, 45:00 when started | optional, 60:00 when started |
| Primary button | **Run Test Cases** | **Submit Solution** |
| New files | discouraged | expected (`server/middleware/authorize.js`, `client/src/utils/permissions.js`) |

Both repositories ship as editable virtual file trees: file explorer, syntax-highlighted multi-file
editor (create / edit / delete / revert), a graded test panel with mock stack traces, and a run console.

---

## Four deliberate design decisions

### 1. You pick the stack before the clock starts

The real assessment asks for a framework first. **Start a mock test** opens a three-step flow:
framework, round, clock. Five profiles are listed — React + Node.js, React + NestJS, Node + Express,
React + Spring Boot, Spring Boot + React Native. This build executes JavaScript in the browser, so the
JavaScript profiles are runnable and the JVM ones are listed but clearly marked *assessment only*,
with the reason stated inline rather than a silent dead end.

### 2. The clock never starts on its own

Untimed is the default. `Start timer` sits in the top bar, in the start flow, and on every question
card. If it reaches zero the editor **stays editable** — pressure rehearsal, not a lock-out.

### 3. The assistant points, it does not patch

The assistant holds the complete file map and will tell you exactly which files have open problems,
as **clickable paths**. It will not write the fix — and it is genuinely useful for the three things
candidates say they used it for: **syntax**, **navigation**, and **understanding how files and routes
connect**.

| You ask | You get |
| --- | --- |
| *"which files have errors"* | A ranked list of file paths with the failing assertion and a signature match, each opening in the editor |
| *"how are the routes connected"* | The full request path drawn for that repo, with the broken links marked |
| *"show me the repository map"* | The annotated file tree |
| *"what does `??` do?"* | A syntax reference table — constructs, what they do, and the gotcha that bites in review |
| *"fix the error"* / *"write the code for me"* | A refusal that redirects you to navigation or a concept |

There is no `patches` array anywhere in the knowledge base. An earlier build could apply edits, and
that turned the exercise into copy-and-paste.

### 4. Six assertions, not thirty

Each assertion isolates one root cause in one file, and each has a matching question in the bank, so
the suite doubles as the answer key.

**Round 1 — the delete-track bug**, six files deep:

- `A-01` `splice(-1, 1)` silently removes the **last** library entry before the code notices the failure
- `A-02` `req.headers.Authorization` is always `undefined`, and the middleware never calls `next()`
- `A-03` an `async` delete handler with no error path, so the request never resolves
- `A-04` a domain error that should be a 404 arrives as a 500
- `A-05` `response.json()` parses a 404 body, so `deleteTrack` resolves as if it worked
- `A-06` `tracks.splice(...)` mutates a prop, so React never re-renders

**Round 2 — the mock awards section:**

- `B-01` `awardService` returns `MOCK_AWARDS` instead of the seven real rows in `db.awards`
- `B-02` an unknown movie answers 200 + empty array instead of 404
- `B-03` login issues a token without checking anything
- `B-04` `authenticate` assigns a literal user and never reads the header
- `B-05` no role guard, and no terminal error handler, so `next(err)` becomes a 500
- `B-06` no shared `can()` helper, so the Edit button is shown to members who will get a 403

---

## The engine is real, not mocked

Nothing is stubbed out — the candidate's code is **compiled and executed inside the page**:

```
candidate source --> new Function(module, exports, require, __filename, __dirname, process, console)
                          |
                          +--> static assertions      (parse source: res.ok, prop mutation, exports)
                          +--> runtime assertions     (execute the module, call its exports)
                          +--> integration assertions
                                 Express simulator boots createApp(),
                                 the middleware stack is flattened the way Express flattens it,
                                 and the suite issues real HTTP requests.
```

`src/lib/sandbox/expressMock.js` reproduces Express 4 semantics precisely enough that the graded
behaviours behave as they would in CI:

- `app.use('/api/tracks', mw)` matches the mount point **and everything beneath it**
- routers are flattened into one ordered layer stack, preserving registration order
- `next(err)` skips non-error layers and lands in the 4-arity error handler
- a synchronous throw or a rejected `async` handler is caught and forwarded, exactly like Express
- `:param` routing, query parsing, `res.status().json()`, 404 fallthrough

That is why *"a member cannot create a nomination"* is a genuine 403 against the candidate's own
route and guard, rather than a regex over a string.

### Self-verifying suites

```bash
npm run verify          # both suites against the untouched repositories  -> 0/6 and 0/6
npm run verify:solved   # both suites against the reference solution      -> 6/6 and 6/6
npm run check           # both
```

Every graded assertion is proven **meaningful** (it fails on the untouched repo) and **achievable**
(the reference patch scores 100%). The gold patches live in `scripts/referenceSolutions.js` and are
never exposed in the UI.

---

## Token budget

Every turn is billed the way a real agent bills it:

| Component | Cost |
| --- | --- |
| System prompt | 1,250 tokens |
| Repo context | 480 per file pulled in, +900 for the active file |
| Your prompt | ~1 token / 4 characters |
| Generated answer | 1.08x generated tokens |
| Turn overhead | 320 |

**Reset token budget** appears in three places: the dashboard *Exam controls* row, the token-meter
dropdown, and the exhaustion modal. It restores a full 200,000 without touching scores, files or
history. At zero the assistant locks and the modal reads
*"Token Budget Exhausted! Task failed due to resource limits."*

---

## UI

True-AMOLED dark theme — canvas is `#000`, elevation is near-black greys, so OLED pixels switch off
entirely.

- **Dashboard** — start flow, round cards, exam controls, stats, scoring explainer, budget ledger
- **Questions** — 20 questions, search + difficulty filter, **Random** picker per round, timed and
  untimed entry
- **Arena** — file tree | editor | right rail (Assistant / Tests / Console / Brief), question banner
  with progressive hints, responsive down to mobile
- **Analytics** — score trend, per-round stats, per-assertion mastery, run history, JSON export

Keyboard: `Ctrl/Cmd + Enter` runs the suite, `Enter` sends a prompt, `Esc` closes dialogs.
All state persists to `localStorage` under `capex-studio:*`. Nothing leaves the browser.

---

## Authentication (Clerk)

Sign-in is wired with [Clerk](https://clerk.com), linked to app `app_3KYBIeYc8ZUOsVfcKLImM4nvcY9`.

- **`@clerk/react` v6** — `clerk init` detected the Vite/React stack and installed the SDK.
- **Adapter, not a dependency leak.** Nothing in the app imports Clerk directly; everything reads
  identity from `useIdentity()` in `src/context/IdentityContext.jsx`. Two bridges:
  - key configured → `ClerkProvider` + `useUser`, rounds and the question bank are gated behind
    sign-in, and each recorded run is attributed to the signed-in user id;
  - no key → a local guest identity, so the studio still runs for anyone who clones the repo.
- **Controls** live in the top bar (`Show when="signed-out"` / `when="signed-in"`), and the gate
  screen offers sign-in and sign-up. Clerk's appearance is themed onto the app's AMOLED palette
  through `appearance.variables` plus a `.cc-clerk-*` block in `src/index.css`.

### Local setup

```bash
cp .env.example .env.local     # then paste your keys from the Clerk dashboard
npm run dev
```

`VITE_CLERK_PUBLISHABLE_KEY` is the only value the browser needs. `CLERK_SECRET_KEY` is server-only
and the app never reads it — it must never appear in a `VITE_`-prefixed variable.

### Before deploying

`clerk doctor` reports one thing you have to fix yourself:

```
! Instance IDs: development (ins_...) (production not configured)
```

The dev key only works on localhost. `clerk deploy` creates the production instance, but it needs a
real domain with DNS records, so it has to run in an interactive terminal:

```bash
clerk deploy          # creates the production instance, prints DNS records, verifies the domain
clerk deploy status   # confirm
```

Then set the **production** publishable key in your host:

```bash
npx vercel env add VITE_CLERK_PUBLISHABLE_KEY production   # paste pk_live_...
npx vercel env add CLERK_SECRET_KEY production            # optional, server-side only
npx vercel --prod
```

### Verification

```bash
npm run check                      # suites
npm run e2e                        # full product flow, guest mode
npm run e2e:auth                   # sign-in wall + Clerk wiring, signed out
```

---

## Deployment

Fully client-side — there is no backend to host, so a static build is the whole deployment.

**Vercel** (config committed as `vercel.json`):

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

The SPA rewrite is already configured, so deep links like `/arena/A` survive a refresh.

**Netlify** alternative — `npm run build`, publish `dist`, and add
`/* /index.html 200` to `_redirects`.

**Render / Railway** are not needed: there is no API process. The "server" in this app is an
in-page Express simulator, so a Node service would serve nothing.

---

## File structure

```
.
├── index.html
├── vercel.json
├── vite.config.js
├── scripts/
│   ├── verify.mjs              # headless suite self-check (baseline + solved)
│   ├── referenceSolutions.js   # gold patches proving every assertion is achievable
│   └── e2e.mjs                 # Chrome DevTools Protocol smoke test of the real UI
└── src/
    ├── main.jsx
    ├── App.jsx                 # routes: / · /questions · /arena/:mode · /analytics
    ├── index.css               # Tailwind v4 @theme — the AMOLED palette
    ├── context/
    │   └── StudioContext.jsx   # sessions, optional timers, files, budget, chat, progress
    ├── lib/
    │   ├── testRunner.js       # orchestration, timeouts, virtual stack traces
    │   ├── staticAnalysis.js   # source-level assertions
    │   ├── highlight.js        # dependency-free JS/JSX/CSS/MD tokenizer
    │   ├── tokens.js           # budget constants + cost model
    │   ├── storage.js          # defensive localStorage helpers
    │   └── sandbox/
    │       ├── assert.js       # Jest-shaped expect() with .not and deep equality
    │       ├── moduleSystem.js # CommonJS loader for the virtual repository
    │       └── expressMock.js  # Express 4 simulator + supertest-shaped client
    ├── data/
    │   ├── questions.js        # 20 questions (10 debug + 10 feature)
    │   ├── defects.js          # known-defect signatures per repo (powers navigation)
    │   ├── stacks.js           # framework selection offered before a round
    │   ├── copilotKnowledge.js # concept playbooks + intent classifiers
    │   ├── copilotEngine.js    # routing: locate -> wiring -> map -> refuse -> concept
    │   ├── modeA/{repo,tests}.js
    │   └── modeB/{repo,tests,requirements}.js
    ├── components/
    │   ├── arena/              # FileExplorer · CodeEditor · TestPanel · RunConsole · TimerBar · TaskPanel
    │   ├── copilot/            # CopilotPanel
    │   ├── common/             # Markdown renderer · TokenExhaustedModal
    │   ├── layout/             # TopBar · TokenMeter
    │   ├── start/              # StartTestModal — stack, round, clock
    │   └── ui/                 # Button · Badge · Card · Modal · Stat
    └── views/
        ├── DashboardView.jsx
        ├── QuestionsView.jsx
        ├── ArenaView.jsx
        └── AnalyticsView.jsx
```

---

## Tests

```bash
npm run check   # suites: 0/6 baseline, 6/6 solved
npm run e2e     # 40 UI checks in headless Chrome (needs a dev server on :5199)
```

`npm run e2e` boots real Chrome over the DevTools Protocol and walks the actual product: the start
flow and stack picker, the question bank and random picker, the optional timer, a suite run, the
assistant's locate / wiring / syntax / refuse behaviour, and the token-budget reset.

---

## Notes and honest limitations

- The client-side `.jsx` files are asserted structurally (imports, call sites, prop mutation) rather
  than rendered — executing JSX would mean shipping a React runtime inside the sandbox, which buys
  very little for assertions about structure and wiring.
- The Copilot is a retrieval engine over curated concepts, not a language model. That is deliberate:
  it makes the token budget a *teaching tool* rather than a random walk, and it keeps the app
  deterministic and offline.
- Only JavaScript stacks are runnable here. That limitation is stated in the picker rather than
  hidden, because silently failing to grade a Java candidate would be worse than saying no.
- Questions marked **new file** are created in the working tree the moment you open them, with a
  TODO stub, so the story is honest about authoring a new module.
- Browser storage is the only persistence layer. Clearing site data resets everything.

Scenario details are drawn from public candidate reports; the repositories, defects and assertions
here are original and calibrated deliberately easier than the live round.
