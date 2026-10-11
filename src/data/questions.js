/**
 * The question bank.
 *
 * 20 self-contained exercises — 10 for the debugging round, 10 for the feature round.
 * Each is calibrated easy → moderate, and the six that map to a graded assertion carry a
 * `test` id, so the suite doubles as the answer key.
 */

export const DEBUGGING_QUESTIONS = [
  {
    id: 'D-01',
    title: 'Deleting the wrong track',
    difficulty: 'Easy',
    tags: ['Arrays', 'Correctness'],
    file: 'server/services/libraryService.js',
    test: 'A-01',
    minutes: 8,
    prompt:
      'A user deletes a track that was never in their library. They get an error — but the track they liked most has disappeared instead, and they only notice on the next page load.',
    hints: [
      'What does Array.prototype.splice do when you hand it -1?',
      'The code throws *after* it has already mutated the array. What order are those two things in?',
    ],
    acceptance: [
      'Removing a track that is not in the library throws, and the library is byte-for-byte unchanged.',
    ],
  },
  {
    id: 'D-02',
    title: 'Every request comes back 401',
    difficulty: 'Moderate',
    tags: ['Express', 'Middleware'],
    file: 'server/middleware/auth.js',
    test: 'A-02',
    minutes: 12,
    prompt:
      'The client sends `Authorization: Bearer tk_nora_77a1`, and that exact token is in the user table at the top of the file. Every request still answers 401.',
    hints: [
      'Log the header name you are reading. What casing does Node actually deliver?',
      'Even when the lookup succeeds — what does your function do next? Does it continue the chain?',
    ],
    acceptance: ['GET /api/tracks with the seeded token answers 200 with three tracks.'],
  },
  {
    id: 'D-03',
    title: 'The delete button hangs',
    difficulty: 'Moderate',
    tags: ['API', 'Error Handling'],
    file: 'server/routes/tracks.js',
    test: 'A-03',
    minutes: 12,
    prompt:
      'Clicking Delete leaves the row spinning forever. The track is still there after a refresh, and nothing is written to the server log.',
    hints: [
      'What can the service throw, and who is catching it?',
      'An async handler that rejects hands nothing back to Express unless you hand it over.',
    ],
    acceptance: [
      'DELETE /api/tracks/:id answers 204 and the track is gone from the library.',
    ],
  },
  {
    id: 'D-04',
    title: '404 arrives as a 500',
    difficulty: 'Moderate',
    tags: ['API', 'Status Codes'],
    file: 'server/routes/tracks.js',
    test: 'A-04',
    minutes: 10,
    prompt:
      'Deleting a track the user never added produces a 500 in the network tab. The service already tells you in its message exactly what kind of failure this is.',
    hints: [
      '"I do not know you" is one status. "I know you, and this does not exist" is a different one.',
      'Catch at the route and answer with the right status, or hand it to an error layer that can.',
    ],
    acceptance: [
      'An unknown track answers 404 and the library length is unchanged.',
    ],
  },
  {
    id: 'D-05',
    title: 'The UI claims success on a failed delete',
    difficulty: 'Easy',
    tags: ['Client', 'Error Handling'],
    file: 'client/src/api/client.js',
    test: 'A-05',
    minutes: 7,
    prompt:
      'The delete button reports success, the row disappears, and after a refresh the track is back. The network tab shows a red 404 with no console error at all.',
    hints: [
      'Does response.json() reject when the body is an error page?',
      'Which property on the response tells you whether the request actually succeeded?',
    ],
    acceptance: ['The wrapper inspects response.ok and throws on a non-2xx response.'],
  },
  {
    id: 'D-06',
    title: 'The deleted row reappears immediately',
    difficulty: 'Easy',
    tags: ['React', 'Props'],
    file: 'client/src/components/TrackRow.jsx',
    test: 'A-06',
    minutes: 6,
    prompt:
      'Clicking Delete blanks the row for a frame and then the tracklist snaps back, as though nothing happened. The server request did go out.',
    hints: [
      'Look at what handleDelete does to the array it was handed.',
      'React decides to re-render by comparing references. Did yours change?',
    ],
    acceptance: ['TrackRow does not write to the tracks array passed in as a prop.'],
  },
  {
    id: 'D-07',
    title: 'Switching account keeps the old library',
    difficulty: 'Moderate',
    tags: ['React', 'Effects'],
    file: 'client/src/hooks/useLibrary.js',
    test: null,
    minutes: 10,
    prompt:
      'Sign out and sign in as the second seeded user. The sidebar shows the new profile but the track list is still the previous user\'s.',
    hints: [
      'The effect closes over something that changed. Is it in the dependency array?',
      'What does an empty dependency array promise the runtime about the closure?',
    ],
    acceptance: ['Changing the user re-runs the fetch.'],
  },
  {
    id: 'D-08',
    title: 'The spinner never clears on failure',
    difficulty: 'Easy',
    tags: ['React', 'State'],
    file: 'client/src/hooks/useLibrary.js',
    test: null,
    minutes: 6,
    prompt:
      'With the API down, the library view shows an endless loading state and no error message. Nothing is logged.',
    hints: [
      'Which branch of the chain clears the loading flag? Is it the only branch?',
      'Which chain method runs whether the promise resolved or rejected?',
    ],
    acceptance: ['The loading flag clears on both the success and the failure path.'],
  },
  {
    id: 'D-09',
    title: 'Track durations show as NaN',
    difficulty: 'Easy',
    tags: ['Numbers', 'Resilience'],
    file: 'client/src/utils/formatTime.js',
    test: null,
    minutes: 5,
    prompt:
      'One row in the table shows "NaN:NaN". That row\'s duration is the only field the API returns as a string rather than a number.',
    hints: ['Which guard catches NaN and Infinity in one check?'],
    acceptance: ['formatTime never renders NaN for a non-numeric or negative input.'],
  },
  {
    id: 'D-10',
    title: 'Playlists disappear when you add a track',
    difficulty: 'Moderate',
    tags: ['React', 'Effects'],
    file: 'client/src/components/PlaylistPanel.jsx',
    test: null,
    minutes: 8,
    prompt:
      'The sidebar collapses every time the library refreshes. Users have to re-open it after every single delete.',
    hints: [
      'An effect that resets state on mount runs again every time its dependencies change identity.',
      'Is a fetched array a stable reference?',
    ],
    acceptance: ['The panel keeps its open state across unrelated re-renders.'],
  },
];

export const FEATURE_QUESTIONS = [
  {
    id: 'F-01',
    title: 'Stop serving the awards from a hard-coded array',
    difficulty: 'Easy',
    tags: ['Data', 'Service'],
    file: 'server/services/awardService.js',
    test: 'B-01',
    minutes: 8,
    prompt:
      'Every award card on every movie page comes from MOCK_AWARDS. Seven real records are already sitting in db.awards — including two ceremonies the mock array has never heard of.',
    hints: [
      'Write the filter against db.awards and delete the constant.',
      'What should the function return for a movie id that has no awards at all?',
    ],
    acceptance: [
      'listForMovie returns the stored rows for that movie and an empty array for an unknown one.',
    ],
  },
  {
    id: 'F-02',
    title: 'A movie with no awards should not look like a broken page',
    difficulty: 'Easy',
    tags: ['API', 'Status Codes'],
    file: 'server/routes/awards.js',
    test: 'B-02',
    minutes: 8,
    prompt:
      'Requesting awards for a movie id that does not exist returns 200 with an empty array, which the client cannot tell apart from "this film was never nominated for anything".',
    hints: [
      'Does db have a helper for looking a movie up?',
      'Keep the { data } envelope — the client already depends on it.',
    ],
    acceptance: [
      'GET /api/awards/:movieId returns real records, and an unknown movie answers 404.',
    ],
  },
  {
    id: 'F-03',
    title: 'Make login actually check the credentials',
    difficulty: 'Easy',
    tags: ['Authentication'],
    file: 'server/routes/auth.js',
    test: 'B-03',
    create: false,
    minutes: 10,
    prompt:
      'POST /api/auth/login answers 200 for an empty body, a wrong password and a correct one alike. It always returns the same token.',
    hints: [
      'db.findUserByEmail already exists and lower-cases the address for you.',
      'Which status means "the body was malformed", and which means "those credentials are wrong"?',
      'One message for both a wrong password and an unknown user, so the endpoint cannot be used to enumerate accounts.',
    ],
    acceptance: [
      'Valid credentials return 200 with a token and the user; wrong password 401; missing field 400.',
    ],
  },
  {
    id: 'F-04',
    title: 'Stop trusting a hard-coded identity',
    difficulty: 'Easy',
    tags: ['Authentication', 'Middleware'],
    file: 'server/middleware/authenticate.js',
    test: 'B-04',
    minutes: 10,
    prompt:
      'Every request is treated as the same user, whoever calls. The Authorization header is never even read, and adding a nomination needs no credential at all.',
    hints: [
      'Split "Bearer <token>" into its two parts before you look anything up.',
      'Two failure paths share a status: no token at all, and a token nobody matches.',
      'req.user needs id, role and orgId — the guard and the store both read them.',
    ],
    acceptance: ['No header → 401. Unknown token → 401. Valid token → the route runs.'],
  },
  {
    id: 'F-05',
    title: 'Only curators and admins may nominate',
    difficulty: 'Moderate',
    tags: ['Authorisation', 'Middleware'],
    file: 'server/middleware/authorize.js',
    test: 'B-05',
    create: true,
    minutes: 15,
    prompt:
      'Any signed-in member can add a nomination, and can therefore rewrite what the site says about a film. Build the guard that stops it.',
    hints: [
      'Export a function that returns a function — that is what makes it reusable per route.',
      'server/utils/errors.js already has forbidden() and unauthorized().',
      'No req.user means unknown (401). A known user with the wrong role means refused (403).',
    ],
    acceptance: [
      'A member POSTing a nomination gets 403; a curator and an admin get 201.',
    ],
  },
  {
    id: 'F-06',
    title: 'Make typed errors actually reach the client',
    difficulty: 'Easy',
    tags: ['Resilience', 'Express'],
    file: 'server/app.js',
    test: 'B-05',
    minutes: 8,
    prompt:
      'server/utils/errors.js carries status codes on every error it creates, and nothing in the app is reading them. As soon as you start using next(err), everything comes back as a 500.',
    hints: [
      'Express identifies an error layer by its arity — how many parameters does it take?',
      'Register it after the routes, and give it a fourth parameter it never uses.',
    ],
    acceptance: [
      'A next(notFound(...)) from a route arrives at the client as 404, not 500.',
    ],
  },
  {
    id: 'F-07',
    title: 'Extract a shared permission helper',
    difficulty: 'Easy',
    tags: ['Client', 'Refactoring'],
    file: 'client/src/utils/permissions.js',
    test: 'B-06',
    create: true,
    minutes: 12,
    prompt:
      'AwardCard renders an Edit button for everyone, including the members who will get a 403 when they click it. Extract the policy into one pure function that can be unit-tested without a renderer.',
    hints: [
      'Signature: can(user, action, movie) → boolean. What should happen when there is no movie?',
      'Why should this file not import React?',
      'Remember: this is UX, not security. The server still enforces everything.',
    ],
    acceptance: ['can() answers correctly for admin, curator, member and no user at all.'],
  },
  {
    id: 'F-08',
    title: 'Sort the awards the way a reader expects',
    difficulty: 'Easy',
    tags: ['Querying'],
    file: 'server/services/awardService.js',
    test: null,
    minutes: 8,
    prompt:
      'Awards arrive in insertion order, so the newest ceremony is at the bottom of the page and winners are scattered between nominees.',
    hints: [
      'Array.prototype.sort mutates — copy before you sort.',
      'Two keys: most recent year first, then winners before nominees within a year.',
    ],
    acceptance: ['listForMovie returns awards newest-first with winners ahead of nominees.'],
  },
  {
    id: 'F-09',
    title: 'The awards page re-fetches on every render',
    difficulty: 'Moderate',
    tags: ['React', 'Effects'],
    file: 'client/src/pages/AwardsPage.jsx',
    test: null,
    minutes: 10,
    prompt:
      'Open the network tab on a movie page and you can see the awards request repeating. The page also shows stale awards when you navigate between two films.',
    hints: [
      'Which value does the effect read, and is it in the dependency array?',
      'If you add it, what else has to become stable?',
    ],
    acceptance: ['Navigating to another movie refetches once and shows that film\'s awards.'],
  },
  {
    id: 'F-10',
    title: 'Own the session in one place',
    difficulty: 'Moderate',
    tags: ['Client', 'State'],
    file: 'client/src/context/AuthContext.jsx',
    test: null,
    minutes: 15,
    prompt:
      'The provider exists but is empty, so a page refresh signs the user out and there is nowhere for the Edit button to ask "may I?".',
    hints: [
      'What does the provider need to hold, and which two actions does it expose?',
      'What happens to a token held only in memory on refresh?',
      'login() should surface the API error, not fail silently.',
    ],
    acceptance: ['The provider exposes login/logout and survives a refresh.'],
  },
];

export const ALL_QUESTIONS = {
  A: DEBUGGING_QUESTIONS,
  B: FEATURE_QUESTIONS,
};

export function questionsFor(mode) {
  return ALL_QUESTIONS[mode] ?? [];
}

export function findQuestion(mode, id) {
  return questionsFor(mode).find((q) => q.id === id) ?? null;
}

export function randomQuestion(mode, excludeId) {
  const pool = questionsFor(mode).filter((q) => q.id !== excludeId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** How long a question should realistically take, for the "estimate" line. */
export function estimatedMinutes(mode) {
  const pool = questionsFor(mode);
  if (pool.length === 0) return 0;
  return pool.reduce((sum, q) => sum + q.minutes, 0);
}
