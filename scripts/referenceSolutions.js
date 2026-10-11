/**
 * Reference (gold) solutions for both rounds.
 *
 * Not shipped in the UI — `npm run verify:solved` uses these to prove that every graded
 * assertion is both (a) failing on the untouched repository and (b) achievable.
 */

export const MODE_A_SOLUTION = {
  'server/middleware/auth.js': `const db = require('../db');

function bearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

function authenticate(req, res, next) {
  const user = db.findUserByToken(bearer(req));

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Bearer token missing or invalid' });
  }

  req.user = { id: user.id, name: user.name, role: user.role };
  return next();
}

module.exports = { authenticate };
`,

  'server/services/libraryService.js': `const db = require('../db');

function libraryFor(userId) {
  return db.library.filter((entry) => entry.userId === userId);
}

function tracksFor(userId) {
  const ids = libraryFor(userId).map((entry) => entry.trackId);
  return db.tracks.filter((track) => ids.indexOf(track.id) !== -1);
}

function isInLibrary(userId, trackId) {
  return libraryFor(userId).some((entry) => entry.trackId === trackId);
}

function addToLibrary(userId, trackId) {
  if (isInLibrary(userId, trackId)) return null;
  const entry = { id: 'lib_' + (db.library.length + 1), userId, trackId, addedAt: new Date().toISOString() };
  db.library.push(entry);
  return entry;
}

function removeFromLibrary(userId, trackId) {
  const index = db.library.findIndex((item) => item.userId === userId && item.trackId === trackId);
  if (index === -1) {
    throw new Error('Track ' + trackId + ' is not in this library');
  }
  db.library.splice(index, 1);
  return true;
}

module.exports = { libraryFor, tracksFor, isInLibrary, addToLibrary, removeFromLibrary };
`,

  'server/routes/tracks.js': `const express = require('express');
const db = require('../db');
const libraryService = require('../services/libraryService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ data: libraryService.tracksFor(req.user.id) });
});

router.get('/:id', (req, res) => {
  const track = db.findTrackById(req.params.id);
  if (!track) {
    return res.status(404).json({ error: 'Track ' + req.params.id + ' not found' });
  }
  res.json({ data: track, inLibrary: libraryService.isInLibrary(req.user.id, track.id) });
});

router.post('/', (req, res) => {
  const entry = libraryService.addToLibrary(req.user.id, req.body.trackId);
  if (!entry) {
    return res.status(409).json({ error: 'Track already in library' });
  }
  res.status(201).json({ data: entry });
});

router.delete('/:id', (req, res, next) => {
  try {
    libraryService.removeFromLibrary(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    if (/not in this library/i.test(err.message)) {
      return res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
    }
    next(err);
  }
});

module.exports = router;
`,

  'client/src/api/client.js': `const BASE_URL = '/api';
const TOKEN_KEY = 'vinyl.token';

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

async function request(path, options) {
  const config = options || {};
  const token = readToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  const response = await fetch(BASE_URL + path, {
    method: config.method || 'GET',
    headers: headers,
    body: config.body ? JSON.stringify(config.body) : undefined
  });

  if (!response.ok) {
    throw new Error('Request failed with status ' + response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function listTracks() {
  const payload = await request('/tracks');
  return payload.data;
}

async function deleteTrack(trackId) {
  await request('/tracks/' + trackId, { method: 'DELETE' });
  return true;
}

module.exports = { request, listTracks, deleteTrack, readToken };
`,

  'client/src/components/TrackRow.jsx': `import { formatTime } from '../utils/formatTime';

export function TrackRow({ track, onDelete, isDeleting }) {
  return (
    <li className="track-row">
      <span className="title">{track.title}</span>
      <span className="artist">{track.artist}</span>
      <span className="duration">{formatTime(track.duration)}</span>
      <button onClick={() => onDelete(track.id)} disabled={isDeleting}>
        {isDeleting ? 'Removing…' : 'Delete'}
      </button>
    </li>
  );
}
`,

  'client/src/hooks/useLibrary.js': `import { useCallback, useEffect, useState } from 'react';
import { listTracks, deleteTrack } from '../api/client';

export function useLibrary(userId) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await listTracks();
        if (active) setTracks(rows);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const remove = useCallback(async (trackId) => {
    setDeleting(trackId);
    try {
      await deleteTrack(trackId);
      setTracks((previous) => previous.filter((track) => track.id !== trackId));
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(null);
    }
  }, []);

  return { tracks, loading, error, deleting, remove };
}
`,
};

export const MODE_B_SOLUTION = {
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

  app.use((req, res) => {
    res.status(404).json({ error: 'Route ' + req.method + ' ' + req.path + ' not found', code: 'NOT_FOUND' });
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Internal Server Error', code: err.code || 'ERROR' });
  });

  return app;
}

module.exports = { createApp };
`,

  'server/services/awardService.js': `const db = require('../db');

function listForMovie(movieId) {
  return db.awards.filter((row) => row.movieId === movieId);
}

function listByCeremony(ceremony) {
  return db.awards.filter((row) => row.ceremony === ceremony);
}

function nominationsForMovie(movieId) {
  return listForMovie(movieId).sort((a, b) => b.year - a.year);
}

function create(movieId, input) {
  return db.record({
    movieId: movieId,
    ceremony: input.ceremony,
    category: input.category,
    year: input.year,
    winner: Boolean(input.winner),
    recipient: input.recipient
  });
}

module.exports = { listForMovie, listByCeremony, nominationsForMovie, create };
`,

  'server/routes/awards.js': `const express = require('express');
const db = require('../db');
const awardService = require('../services/awardService');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { badRequest, notFound } = require('../utils/errors');

const router = express.Router();

router.get('/:movieId', (req, res, next) => {
  try {
    if (!db.findMovieById(req.params.movieId)) {
      return next(notFound('Movie ' + req.params.movieId + ' not found'));
    }
    res.json({ data: awardService.nominationsForMovie(req.params.movieId) });
  } catch (err) {
    next(err);
  }
});

router.post('/:movieId', authenticate, authorize('curator', 'admin'), (req, res, next) => {
  try {
    if (!db.findMovieById(req.params.movieId)) {
      return next(notFound('Movie ' + req.params.movieId + ' not found'));
    }
    const body = req.body || {};
    if (!body.ceremony || !body.category) {
      return next(badRequest('ceremony and category are required'));
    }
    const created = awardService.create(req.params.movieId, body);
    return res.status(201).json({ data: created });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
`,

  'server/middleware/authenticate.js': `const db = require('../db');
const { unauthorized } = require('../utils/errors');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  const scheme = parts[0];
  const token = parts[1];

  if (!token || String(scheme).toLowerCase() !== 'bearer') {
    return next(unauthorized('Authorization header must be "Bearer <token>"'));
  }

  const user = db.findUserByToken(token);
  if (!user) {
    return next(unauthorized('Token is invalid or has expired'));
  }

  req.user = { id: user.id, role: user.role, orgId: user.orgId, email: user.email };
  return next();
}

module.exports = { authenticate };
`,

  'server/middleware/authorize.js': `const { forbidden, unauthorized } = require('../utils/errors');

const ROLE_PERMISSIONS = {
  admin: ['award.view', 'award.nominate', 'award.edit', 'user.manage'],
  curator: ['award.view', 'award.nominate', 'award.edit'],
  member: ['award.view']
};

function authorize(...roles) {
  const allowed = roles.flat();

  return function guard(req, res, next) {
    if (!req.user) {
      return next(unauthorized());
    }
    if (allowed.length === 0 || allowed.indexOf(req.user.role) !== -1) {
      return next();
    }
    return next(forbidden('Role "' + req.user.role + '" cannot perform this action'));
  };
}

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

module.exports = { authorize, permissionsFor, ROLE_PERMISSIONS };
`,

  'server/routes/auth.js': `const express = require('express');
const db = require('../db');
const { badRequest, unauthorized } = require('../utils/errors');

const router = express.Router();

router.post('/login', (req, res, next) => {
  const body = req.body || {};
  const email = body.email;
  const password = body.password;

  if (!email || !password) {
    return next(badRequest('email and password are required'));
  }

  const user = db.findUserByEmail(email);
  if (!user || user.password !== password) {
    return next(unauthorized('Invalid email or password'));
  }

  return res.json({
    token: user.token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId }
  });
});

router.get('/me', (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.split(' ')[1];
  const user = db.findUserByToken(token);
  if (!user) return next(unauthorized());
  res.json({ data: { id: user.id, role: user.role, email: user.email, name: user.name } });
});

module.exports = router;
`,

  'client/src/utils/permissions.js': `const MATRIX = {
  admin: { 'award.view': true, 'award.nominate': true, 'award.edit': true, 'user.manage': true },
  curator: { 'award.view': true, 'award.nominate': true, 'award.edit': true },
  member: { 'award.view': true, 'award.nominate': false, 'award.edit': false }
};

function can(user, action, movie) {
  if (!user) return false;
  const rule = MATRIX[user.role] ? MATRIX[user.role][action] : undefined;
  if (rule === undefined || rule === false) return false;
  if (action === 'award.view') return true;
  return Boolean(rule);
}

module.exports = { can, MATRIX };
`,
};
