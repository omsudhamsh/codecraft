/**
 * ROUND 1 — AI-Assisted Debugging
 * Repository: "vinyl" — a music-streaming service in the shape of Spotify.
 *
 * Reported symptom: deleting a track from the library fails. The UI shows a spinner that
 * never resolves, sometimes the wrong row disappears, and after a refresh the track is
 * still there. Seven defects are spread across the request path that make that happen.
 */

export const MODE_A = {
  id: 'debug',
  key: 'A',
  title: 'AI-Assisted Debugging Round',
  repoName: 'vinyl-music',
  appName: 'Vinyl',
  durationMinutes: 45,
  language: 'JavaScript / Node + React',
  stack: ['Node.js 20', 'Express 4', 'React 18'],
  objective:
    'A user cannot delete a track from their library. Trace the request across client, route, middleware and service until the delete behaves correctly.',
  brief: [
    'Vinyl is a music-streaming service — catalogue, library, playlists.',
    'QA filed one ticket: "delete a track does nothing, or deletes the wrong row".',
    'The branch has not been green since the library rewrite. Your job is to find why, one file at a time.',
  ],
  constraints: [
    'Do not change route paths or response shapes — only behaviour.',
    'Do not edit the test files.',
    'The assistant will point you at files and explain concepts; it will not write the fix.',
  ],
};

export const MODE_A_FILES = {
  'package.json': `{
  "name": "vinyl-music",
  "version": "2.1.0",
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

  'README.md': `# Vinyl

Music streaming service. Express API + React client.

    server/
      index.js                       process entry
      app.js                         express app — middleware and routes
      middleware/auth.js            bearer-token authentication
      routes/tracks.js               /api/tracks
      routes/playlists.js            /api/playlists
      services/libraryService.js     catalogue + library access
      utils/duration.js              track duration helpers
      db.js                          in-memory store and seed data
    client/src/
      api/client.js                  fetch wrapper
      hooks/useLibrary.js            library loading + mutations
      components/TrackRow.jsx        one row in the track table
      components/PlaylistPanel.jsx   sidebar
      utils/formatTime.js            mm:ss formatting
    tests/

## Open ticket
Deleting a track from the library fails. Reproduce with the \`DELETE /api/tracks/:id\` endpoint
and the Delete button in \`TrackRow\`.
`,

  'server/db.js': `const USERS = [
  { id: 'u_1', email: 'nora@vinyl.fm', token: 'tk_nora_77a1', name: 'Nora Devi', role: 'member' },
  { id: 'u_2', email: 'sam@vinyl.fm', token: 'tk_sam_3b40', name: 'Sam Ortiz', role: 'member' }
];

const TRACKS = [
  { id: 'tr_9001', title: 'Midnight Commute', artist: 'The Lantern Club', album: 'Nightlines', duration: 214, genre: 'indie' },
  { id: 'tr_9002', title: 'Paper Planes', artist: 'Mira Sound', album: 'Altitude', duration: 187, genre: 'pop' },
  { id: 'tr_9003', title: 'Low Tide', artist: 'Harbour Lights', album: 'Saltwater', duration: 243, genre: 'ambient' },
  { id: 'tr_9004', title: 'Static Bloom', artist: 'The Lantern Club', album: 'Nightlines', duration: 198, genre: 'indie' },
  { id: 'tr_9005', title: 'Neon Arterial', artist: 'Vector Youth', album: 'Overpass', duration: 265, genre: 'electronic' }
];

const LIBRARY = [
  { id: 'lib_1', userId: 'u_1', trackId: 'tr_9001', addedAt: '2026-02-01T10:00:00.000Z' },
  { id: 'lib_2', userId: 'u_1', trackId: 'tr_9003', addedAt: '2026-02-03T12:30:00.000Z' },
  { id: 'lib_3', userId: 'u_1', trackId: 'tr_9005', addedAt: '2026-02-06T08:15:00.000Z' },
  { id: 'lib_4', userId: 'u_2', trackId: 'tr_9002', addedAt: '2026-02-07T19:00:00.000Z' }
];

const PLAYLISTS = [
  { id: 'pl_1', name: 'Late Shift', ownerId: 'u_1', trackIds: ['tr_9001', 'tr_9003'] },
  { id: 'pl_2', name: 'Focus', ownerId: 'u_1', trackIds: ['tr_9005'] }
];

const db = {
  users: USERS,
  tracks: TRACKS,
  library: LIBRARY,
  playlists: PLAYLISTS,

  findUserByToken(token) {
    return this.users.find((u) => u.token === token) || null;
  },
  findUserByEmail(email) {
    return this.users.find((u) => u.email === String(email).toLowerCase()) || null;
  },
  findTrackById(id) {
    return this.tracks.find((t) => t.id === id) || null;
  }
};

module.exports = db;
`,

  'server/utils/duration.js': `function toSeconds(input) {
  const parts = String(input).split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function totalDuration(tracks) {
  return (Array.isArray(tracks) ? tracks : []).reduce((acc, track) => acc + track.duration, 0);
}

module.exports = { toSeconds, totalDuration };
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
  db.library.splice(index, 1);
  if (index === -1) {
    throw new Error('Track ' + trackId + ' is not in this library');
  }
  return true;
}

module.exports = { libraryFor, tracksFor, isInLibrary, addToLibrary, removeFromLibrary };
`,

  'server/middleware/auth.js': `const db = require('../db');

function bearer(req) {
  const header = req.headers.Authorization;
  if (!header) return null;
  const parts = header.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

function authenticate(req, res, next) {
  const user = db.findUserByToken(bearer(req));

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Bearer token missing or invalid' });
  }

  req.user = { id: user.id, name: user.name, role: user.role };
}

module.exports = { authenticate };
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

router.delete('/:id', async (req, res) => {
  libraryService.removeFromLibrary(req.user.id, req.params.id);
  res.status(204).end();
});

module.exports = router;
`,

  'server/routes/playlists.js': `const express = require('express');
const db = require('../db');
const duration = require('../utils/duration');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.playlists
    .filter((playlist) => playlist.ownerId === req.user.id)
    .map((playlist) => {
      const tracks = playlist.trackIds.map((id) => db.findTrackById(id)).filter(Boolean);
      return { ...playlist, trackCount: tracks.length, duration: duration.totalDuration(tracks) };
    });
  res.json({ data: rows });
});

module.exports = router;
`,

  'server/app.js': `const express = require('express');
const { authenticate } = require('./middleware/auth');
const trackRoutes = require('./routes/tracks');
const playlistRoutes = require('./routes/playlists');

function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/tracks', authenticate, trackRoutes);
  app.use('/api/playlists', authenticate, playlistRoutes);

  return app;
}

module.exports = { createApp };
`,

  'server/index.js': `const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 4100;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('vinyl api listening on ' + PORT);
  });
}

module.exports = app;
`,

  'client/src/utils/formatTime.js': `function formatTime(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '0:00';
  const minutes = Math.floor(total / 60);
  const rest = Math.floor(total % 60);
  return minutes + ':' + String(rest).padStart(2, '0');
}

function formatAddedAt(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

module.exports = { formatTime, formatAddedAt };
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
  const response = await fetch(BASE_URL + path, {
    method: config.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: config.body ? JSON.stringify(config.body) : undefined
  });

  return response.json();
}

function listTracks() {
  return request('/tracks').then(function (payload) {
    return payload.data;
  });
}

function deleteTrack(trackId) {
  return request('/tracks/' + trackId, { method: 'DELETE' }).then(function () {
    return true;
  });
}

module.exports = { request, listTracks, deleteTrack, readToken };
`,

  'client/src/hooks/useLibrary.js': `import { useEffect, useState } from 'react';
import { listTracks, deleteTrack } from '../api/client';

export function useLibrary(userId) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    listTracks()
      .then((rows) => {
        setTracks(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
      });
  }, []);

  async function remove(trackId) {
    setDeleting(trackId);
    try {
      await deleteTrack(trackId);
      setTracks(tracks.filter((track) => track.id !== trackId));
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(null);
    }
  }

  return { tracks, loading, error, deleting, remove };
}
`,

  'client/src/components/TrackRow.jsx': `import { formatTime } from '../utils/formatTime';

export function TrackRow({ track, tracks, onDelete, isDeleting }) {
  function handleDelete() {
    const index = tracks.findIndex((item) => item.id === track.id);
    tracks.splice(index, 1);
    onDelete(track.id);
  }

  return (
    <li className="track-row">
      <span className="title">{track.title}</span>
      <span className="artist">{track.artist}</span>
      <span className="duration">{formatTime(track.duration)}</span>
      <button onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? 'Removing…' : 'Delete'}
      </button>
    </li>
  );
}
`,

  'client/src/components/PlaylistPanel.jsx': `import { useEffect, useState } from 'react';

export function PlaylistPanel({ playlists }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [playlists]);

  return (
    <aside className="playlist-panel">
      <button onClick={() => setOpen(!open)}>Playlists</button>
      {open && (
        <ul>
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              {playlist.name} · {playlist.trackCount} tracks
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
`,
};
