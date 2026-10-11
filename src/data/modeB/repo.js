/**
 * ROUND 2 — AI-Assisted Feature Development
 * Repository: "cinevault" — a movie platform whose Awards section is entirely mock data.
 *
 * The `/awards` surface renders, looks plausible, and is wired to nothing. Everything it
 * shows comes from a hard-coded array in `awardService.js` instead of the records that
 * already exist in the store. The candidate must make it real, and add the account and
 * permission layer the platform is missing.
 */

export const MODE_B = {
  id: 'feature',
  key: 'B',
  title: 'AI-Assisted Feature Development Round',
  repoName: 'cinevault-web',
  appName: 'CineVault',
  durationMinutes: 60,
  language: 'JavaScript / Node + React',
  stack: ['Node.js 20', 'Express 4', 'React 18'],
  objective:
    'The Awards & Recognition section on every movie page is fed by mock data. Replace it with the real records, then add the accounts and permissions the platform never got.',
  brief: [
    'CineVault is a movie browsing platform: catalogue, movie detail pages, an Awards section.',
    'The Awards section renders, but every card comes from a hard-coded array — nothing is stored, nothing is filtered, nothing is permission checked.',
    'Deliver the section end to end: real data, real endpoints, and a UI that respects who is asking.',
  ],
  constraints: [
    'New files are expected — creating `/server/middleware/authorize.js` and `/client/src/utils/permissions.js` is part of the work.',
    'Route paths and the `{ data }` response envelope must stay backward compatible.',
    'The assistant points at files and explains concepts; it does not implement the story.',
  ],
};

export const MODE_B_FILES = {
  'package.json': `{
  "name": "cinevault-web",
  "version": "0.7.0",
  "private": true,
  "scripts": {
    "start": "node server/index.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
`,

  'README.md': `# CineVault

Movie platform. Express API + React client.

    server/
      index.js                       process entry
      app.js                         express app — middleware and routes
      db.js                          in-memory store: movies, people, awards, users
      middleware/authenticate.js     request pipeline (stub)
      middleware/authorize.js        ← does not exist
      routes/auth.js                 POST /api/auth/login, GET /api/auth/me
      routes/movies.js               GET /api/movies, GET /api/movies/:id
      routes/awards.js               GET /api/awards/:movieId (mock data)
      services/movieService.js       catalogue access
      services/awardService.js       award lookups (hard-coded mock data)
      utils/errors.js                typed HTTP errors
    client/src/
      api/movies.js                  fetch wrappers
      context/AuthContext.jsx        session (stub)
      pages/MovieDetail.jsx          movie page
      pages/AwardsPage.jsx           awards & recognition
      components/AwardCard.jsx       one award
      utils/permissions.js           ← does not exist
    tests/

## Known issue — Awards & Recognition
Every card on the awards page comes from \`MOCK_AWARDS\` in \`server/services/awardService.js\`.
The records that belong in the store already exist in \`db.js\`; nothing reads them.
`,

  'server/db.js': `const USERS = [
  {
    id: 'u_admin',
    email: 'dana@cinevault.tv',
    password: 'admin123',
    token: 'cv_admin_0001',
    name: 'Dana Okoro',
    role: 'admin',
    orgId: 'org_cinevault'
  },
  {
    id: 'u_curator',
    email: 'luis@cinevault.tv',
    password: 'curator123',
    token: 'cv_curator_0002',
    name: 'Luis Ferreira',
    role: 'curator',
    orgId: 'org_cinevault'
  },
  {
    id: 'u_member',
    email: 'mina@cinevault.tv',
    password: 'member123',
    token: 'cv_member_0003',
    name: 'Mina Haddad',
    role: 'member',
    orgId: 'org_cinevault'
  }
];

const MOVIES = [
  { id: 'mv_101', title: 'The Long Signal', year: 2024, runtime: 128, genre: 'sci-fi', directorId: 'pp_1' },
  { id: 'mv_102', title: 'Salt and Iron', year: 2023, runtime: 141, genre: 'drama', directorId: 'pp_2' },
  { id: 'mv_103', title: 'Paper Kingdoms', year: 2025, runtime: 117, genre: 'animation', directorId: 'pp_3' },
  { id: 'mv_104', title: 'Every Second Spring', year: 2022, runtime: 96, genre: 'documentary', directorId: 'pp_4' }
];

const PEOPLE = [
  { id: 'pp_1', name: 'Adaeze Nwosu', kind: 'director' },
  { id: 'pp_2', name: 'Tomas Brandt', kind: 'director' },
  { id: 'pp_3', name: 'Rina Kato', kind: 'director' },
  { id: 'pp_4', name: 'Jonas Feld', kind: 'director' }
];

const AWARDS = [
  { id: 'aw_1', movieId: 'mv_101', ceremony: 'Aurora Awards', category: 'Best Cinematography', year: 2025, winner: true, recipient: 'Adaeze Nwosu' },
  { id: 'aw_2', movieId: 'mv_101', ceremony: 'Aurora Awards', category: 'Best Original Score', year: 2025, winner: false, recipient: 'Hana Ito' },
  { id: 'aw_3', movieId: 'mv_101', ceremony: 'Northlight Film Prize', category: 'Audience Choice', year: 2024, winner: true, recipient: 'Adaeze Nwosu' },
  { id: 'aw_4', movieId: 'mv_102', ceremony: 'Aurora Awards', category: 'Best Actor', year: 2025, winner: true, recipient: 'Marek Voss' },
  { id: 'aw_5', movieId: 'mv_102', ceremony: 'Aurora Awards', category: 'Best Adapted Screenplay', year: 2025, winner: false, recipient: 'Tomas Brandt' },
  { id: 'aw_6', movieId: 'mv_103', ceremony: 'Frame International', category: 'Best Animation', year: 2026, winner: true, recipient: 'Rina Kato' },
  { id: 'aw_7', movieId: 'mv_104', ceremony: 'Northlight Film Prize', category: 'Best Documentary', year: 2023, winner: true, recipient: 'Jonas Feld' }
];

const db = {
  users: USERS,
  movies: MOVIES,
  people: PEOPLE,
  awards: AWARDS,

  findUserByEmail(email) {
    return this.users.find((u) => u.email === String(email).toLowerCase()) || null;
  },
  findUserByToken(token) {
    return this.users.find((u) => u.token === token) || null;
  },
  findMovieById(id) {
    return this.movies.find((m) => m.id === id) || null;
  },
  nextAwardId() {
    const highest = this.awards.reduce((max, row) => Math.max(max, Number(row.id.slice(3))), 0);
    return 'aw_' + (highest + 1);
  },
  record(entry) {
    const row = Object.assign({ id: this.nextAwardId() }, entry);
    this.awards.push(row);
    return row;
  }
};

module.exports = db;
`,

  'server/utils/errors.js': `class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code || 'ERROR';
  }
}

function unauthorized(message) {
  return new HttpError(401, message || 'Authentication required', 'UNAUTHORIZED');
}

function forbidden(message) {
  return new HttpError(403, message || 'You do not have access to this resource', 'FORBIDDEN');
}

function notFound(message) {
  return new HttpError(404, message || 'Resource not found', 'NOT_FOUND');
}

function badRequest(message) {
  return new HttpError(400, message || 'Bad request', 'BAD_REQUEST');
}

module.exports = { HttpError, unauthorized, forbidden, notFound, badRequest };
`,

  'server/services/movieService.js': `const db = require('../db');

function listAll(query) {
  const q = query || {};
  let rows = db.movies.slice();
  if (q.genre) rows = rows.filter((movie) => movie.genre === q.genre);
  if (q.search) {
    const needle = String(q.search).toLowerCase();
    rows = rows.filter((movie) => movie.title.toLowerCase().indexOf(needle) !== -1);
  }
  return rows;
}

function findById(id) {
  return db.movies.find((movie) => movie.id === id) || null;
}

function directorOf(movie) {
  if (!movie) return null;
  return db.people.find((person) => person.id === movie.directorId) || null;
}

module.exports = { listAll, findById, directorOf };
`,

  'server/services/awardService.js': `const db = require('../db');

// TODO(feature): these cards are hard-coded. The real records already live in db.awards.
const MOCK_AWARDS = [
  { id: 'mock-1', movieId: 'mv_101', ceremony: 'Aurora Awards', category: 'Best Cinematography', year: 2025, winner: true, recipient: 'Adaeze Nwosu' },
  { id: 'mock-2', movieId: 'mv_101', ceremony: 'Aurora Awards', category: 'Best Original Score', year: 2025, winner: false, recipient: 'Hana Ito' },
  { id: 'mock-3', movieId: 'mv_102', ceremony: 'Aurora Awards', category: 'Best Actor', year: 2025, winner: true, recipient: 'Marek Voss' }
];

function listForMovie(movieId) {
  return MOCK_AWARDS.filter((row) => row.movieId === movieId);
}

function listByCeremony(ceremony) {
  return MOCK_AWARDS.filter((row) => row.ceremony === ceremony);
}

module.exports = { MOCK_AWARDS, listForMovie, listByCeremony, db };
`,

  'server/middleware/authenticate.js': `const db = require('../db');

// TODO(feature): validate the Authorization header and resolve the real user.
function authenticate(req, res, next) {
  req.user = { id: 'u_member', role: 'member', orgId: 'org_cinevault' };
  next();
}

module.exports = { authenticate, db };
`,

  'server/routes/auth.js': `const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  // TODO(feature): verify the credentials and return the matched user.
  res.json({ token: 'development-token', user: { id: 'u_member', role: 'member' } });
});

router.get('/me', (req, res) => {
  res.json({ data: { id: 'u_member', role: 'member' } });
});

module.exports = router;
`,

  'server/routes/movies.js': `const express = require('express');
const movieService = require('../services/movieService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ data: movieService.listAll(req.query) });
});

router.get('/:id', (req, res) => {
  const movie = movieService.findById(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'Movie ' + req.params.id + ' not found' });
  }
  res.json({ data: { ...movie, director: movieService.directorOf(movie) } });
});

module.exports = router;
`,

  'server/routes/awards.js': `const express = require('express');
const awardService = require('../services/awardService');

const router = express.Router();

router.get('/:movieId', (req, res) => {
  const rows = awardService.listForMovie(req.params.movieId);
  res.json({ data: rows, source: 'mock' });
});

module.exports = router;
`,

  'server/app.js': `const express = require('express');
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const awardRoutes = require('./routes/awards');

function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/movies', movieRoutes);
  app.use('/api/awards', awardRoutes);

  return app;
}

module.exports = { createApp };
`,

  'server/index.js': `const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 5200;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('cinevault api listening on ' + PORT);
  });
}

module.exports = app;
`,

  'client/src/api/movies.js': `const BASE_URL = '/api';

async function request(path, options) {
  const config = options || {};
  const response = await fetch(BASE_URL + path, {
    method: config.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: config.body ? JSON.stringify(config.body) : undefined
  });
  return response.json();
}

export async function listMovies(query) {
  const payload = await request('/movies' + (query || ''));
  return payload.data;
}

export async function listAwards(movieId) {
  const payload = await request('/awards/' + movieId);
  return payload.data;
}

export async function addNomination(movieId, input) {
  const payload = await request('/awards/' + movieId, {
    method: 'POST',
    body: input
  });
  return payload.data;
}
`,

  'client/src/context/AuthContext.jsx': `import { createContext, useContext } from 'react';

// TODO(feature): own the session — user, token, login, logout — in one provider.
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
`,

  'client/src/components/AwardCard.jsx': `export function AwardCard({ award, onEdit }) {
  return (
    <article className="award-card">
      <h4>{award.category}</h4>
      <p className="ceremony">
        {award.ceremony} · {award.year}
      </p>
      <p className="recipient">{award.recipient}</p>
      <button onClick={() => onEdit && onEdit(award)}>Edit</button>
    </article>
  );
}
`,

  'client/src/pages/AwardsPage.jsx': `import { useEffect, useState } from 'react';
import { AwardCard } from '../components/AwardCard';
import { listAwards } from '../api/movies';

export function AwardsPage({ movieId }) {
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAwards(movieId)
      .then((rows) => {
        setAwards(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading awards…</p>;

  return (
    <section className="awards-page">
      <h2>Awards &amp; Recognition</h2>
      <div className="award-grid">
        {awards.map((award) => (
          <AwardCard key={award.id} award={award} />
        ))}
      </div>
    </section>
  );
}
`,

  'client/src/pages/MovieDetail.jsx': `import { useEffect, useState } from 'react';
import { AwardsPage } from './AwardsPage';

export function MovieDetail({ movieId }) {
  const [movie, setMovie] = useState(null);

  useEffect(() => {
    fetch('/api/movies/' + movieId)
      .then((response) => response.json())
      .then((payload) => setMovie(payload.data));
  }, [movieId]);

  if (!movie) return <p className="loading">Loading…</p>;

  return (
    <article className="movie-detail">
      <h1>{movie.title}</h1>
      <p className="meta">
        {movie.year} · {movie.runtime} min · {movie.director?.name}
      </p>
      <AwardsPage movieId={movie.id} />
    </article>
  );
}
`,
};
