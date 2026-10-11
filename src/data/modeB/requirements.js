/**
 * ROUND 2 — the product story.
 *
 * Six stories, one per graded assertion (F-01 … F-06). The first two replace the mock
 * data with the real records; the rest add the account and permission layer the platform
 * never had. Everything is reachable in an hour by someone who has written Express before.
 */

export const MODE_B_REQUIREMENTS = {
  epic: 'EPIC-231 · Awards & Recognition, plus the account layer it needs',
  persona:
    'As a CineVault viewer I expect the awards on a film to be real and current, and as a curator I expect only curators to be able to change them.',

  stories: [
    {
      id: 'F-01',
      title: 'Serve the awards from the store',
      question: 'F-01',
      points: 15,
      body: 'server/services/awardService.js returns MOCK_AWARDS. Seven real records already live in db.awards.',
      acceptance: [
        'listForMovie(movieId) returns the stored rows for that movie.',
        'A movie with no awards returns an empty array, not the mock list.',
        'The hard-coded constant is gone.',
      ],
    },
    {
      id: 'F-02',
      title: 'A movie that does not exist is a 404, not an empty list',
      question: 'F-02',
      points: 15,
      body: 'GET /api/awards/:movieId should tell the client whether the film is real.',
      acceptance: [
        'A known movie returns 200 with its real awards in the { data } envelope.',
        'An unknown movie id returns 404.',
      ],
    },
    {
      id: 'F-03',
      title: 'Make login check the credentials',
      question: 'F-03',
      points: 15,
      body: 'POST /api/auth/login currently returns a fixed token for any input, including an empty body.',
      acceptance: [
        'Valid seeded credentials return 200 with the token and the user record.',
        'A wrong password and an unknown email both return 401, with the same message.',
        'A body missing email or password returns 400.',
      ],
    },
    {
      id: 'F-04',
      title: 'Authenticate the write path',
      question: 'F-04',
      points: 15,
      body: 'server/middleware/authenticate.js assigns a hard-coded user and never reads the header.',
      acceptance: [
        'No header → 401, and the route handler never runs.',
        'Unknown token → 401.',
        'A valid token → the request proceeds, with req.user carrying id, role and orgId.',
      ],
    },
    {
      id: 'F-05',
      title: 'Only curators and admins may nominate',
      question: 'F-05',
      points: 20,
      body: 'Create server/middleware/authorize.js exporting authorize(...roles), and use it on POST /api/awards/:movieId. You will also need a terminal error handler so your typed errors reach the client.',
      acceptance: [
        'It is a factory, so each route declares its own policy.',
        'A member posting a nomination gets 403; a curator and an admin get 201.',
        '401 (unknown) stays distinguishable from 403 (refused).',
      ],
    },
    {
      id: 'F-06',
      title: 'One shared permission helper on the client',
      question: 'F-06',
      points: 20,
      body: 'AwardCard renders an Edit button for everyone, including members who will get a 403. Create client/src/utils/permissions.js exporting can(user, action, movie) and use it.',
      acceptance: [
        'Pure and unit-testable — no React import.',
        'can() answers true for admin and curator on award.nominate, false for member.',
        'award.view is true for every signed-in role, and false for no user at all.',
      ],
    },
  ],

  definitionOfDone: [
    'No card on the site is rendered from mock data any more.',
    'No authorisation decision is made only in the UI.',
    'Every failure path answers with the { error, code } envelope and a correct status.',
    'A reviewer can tell which story each hunk satisfies.',
  ],

  seededUsers: [
    { email: 'dana@cinevault.tv', password: 'admin123', role: 'admin' },
    { email: 'luis@cinevault.tv', password: 'curator123', role: 'curator' },
    { email: 'mina@cinevault.tv', password: 'member123', role: 'member' },
  ],
};

export const MODE_B_ROUTES = [
  { method: 'POST', path: '/api/auth/login', status: 'fixed token, no check', auth: 'public' },
  { method: 'GET', path: '/api/auth/me', status: 'stub', auth: 'public' },
  { method: 'GET', path: '/api/movies', status: 'works — leave it alone', auth: 'public' },
  { method: 'GET', path: '/api/awards/:movieId', status: 'mock data, no 404', auth: 'public' },
  { method: 'POST', path: '/api/awards/:movieId', status: 'does not exist', auth: '—' },
];

export const MODE_B_SCOPE = {
  admin: 'full control of nominations',
  curator: 'may nominate and edit',
  member: 'may view only',
};
