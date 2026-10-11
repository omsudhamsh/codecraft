/**
 * ROUND 1 — graded assertions for the debugging round.
 *
 * Six assertions, calibrated easy → moderate. They all sit on the same user-visible bug —
 * "deleting a track does nothing, or deletes the wrong row" — so solving them in order
 * walks the request path from service to route to middleware to client.
 */

import { matches } from '../../lib/staticAnalysis.js';

export const MODE_A_MOCKS = {
  cors: () => (_req, _res, next) => next(),
  helmet: () => (_req, _res, next) => next(),
  morgan: () => (_req, _res, next) => next(),
};

const AUTH = { authorization: 'Bearer tk_nora_77a1' };

const file = (ctx, path) => {
  if (!ctx.exists(path)) ctx.expect.fail(`Expected file ${path} to exist in the repository.`);
  return ctx.read(path);
};

export const MODE_A_TESTS = [
  {
    id: 'A-01',
    title: 'removeFromLibrary rejects an unknown track without touching the library',
    file: 'server/services/libraryService.js',
    kind: 'runtime',
    category: 'Correctness',
    severity: 'major',
    difficulty: 'Easy',
    points: 15,
    question: 'D-01',
    hint: 'Array.prototype.splice with a negative index counts from the end of the array.',
    run: async (ctx) => {
      const service = ctx.load('server/services/libraryService.js');
      const db = ctx.load('server/db.js');
      const before = db.library.length;

      let threw = false;
      try {
        service.removeFromLibrary('u_1', 'tr_9999');
      } catch (err) {
        threw = true;
        ctx.expect(String(err.message)).toMatch(/not in this library/i);
      }

      ctx.expect(threw).toBe(true);
      ctx.expect(db.library.length).toBe(before);
    },
  },

  {
    id: 'A-02',
    title: 'A valid bearer token is not rejected with 401',
    file: 'server/middleware/auth.js',
    kind: 'integration',
    category: 'API',
    severity: 'critical',
    difficulty: 'Moderate',
    points: 20,
    question: 'D-02',
    appFactory: { path: 'server/app.js', export: 'createApp' },
    hint: 'Two separate things: how the header is read, and what the middleware does once it finds the user.',
    run: async (ctx) => {
      const res = await ctx.api.get('/api/tracks', { headers: AUTH });
      ctx.expect(res.status).toBe(200);
      ctx.expect(res.body?.data).toHaveLength(3);
    },
  },

  {
    id: 'A-03',
    title: 'DELETE /api/tracks/:id removes the track and answers 204',
    file: 'server/routes/tracks.js',
    kind: 'integration',
    category: 'API',
    severity: 'critical',
    difficulty: 'Moderate',
    points: 20,
    question: 'D-03',
    appFactory: { path: 'server/app.js', export: 'createApp' },
    hint: 'The handler awaits work that can throw. Decide where that failure belongs.',
    run: async (ctx) => {
      const res = await ctx.api.delete('/api/tracks/tr_9003', { headers: AUTH });
      ctx.expect(res.status).toBe(204);

      const after = await ctx.api.get('/api/tracks', { headers: AUTH });
      ctx.expect(after.body?.data).toHaveLength(2);
      const ids = after.body.data.map((t) => t.id);
      ctx.expect(ids).not.toContain('tr_9003');
    },
  },

  {
    id: 'A-04',
    title: 'Deleting a track that is not in the library answers 404, not 500',
    file: 'server/routes/tracks.js',
    kind: 'integration',
    category: 'API',
    severity: 'major',
    difficulty: 'Moderate',
    points: 15,
    question: 'D-04',
    appFactory: { path: 'server/app.js', export: 'createApp' },
    hint: 'The service already tells you, in its message, what kind of failure this is.',
    run: async (ctx) => {
      const before = await ctx.api.get('/api/tracks', { headers: AUTH });

      const res = await ctx.api.delete('/api/tracks/tr_9999', { headers: AUTH });
      ctx.expect(res.status).toBe(404);
      ctx.expect(String(res.body?.error ?? '')).toMatch(/not in this library/i);

      const after = await ctx.api.get('/api/tracks', { headers: AUTH });
      ctx.expect(after.body?.data).toHaveLength(before.body.data.length);
    },
  },

  {
    id: 'A-05',
    title: 'The fetch wrapper inspects response.ok before parsing',
    file: 'client/src/api/client.js',
    kind: 'static',
    category: 'Error Handling',
    severity: 'major',
    difficulty: 'Easy',
    points: 15,
    question: 'D-05',
    hint: 'response.json() succeeds on a 500 body too, so deleteTrack resolves as if it worked.',
    run: async (ctx) => {
      const src = file(ctx, 'client/src/api/client.js');
      ctx.expect(matches(src, /response\s*\.\s*ok/)).toBe(true);
      ctx.expect(matches(src, /throw\s+new\s+\w*Error/)).toBe(true);
    },
  },

  {
    id: 'A-06',
    title: 'TrackRow never mutates the tracks array it receives',
    file: 'client/src/components/TrackRow.jsx',
    kind: 'static',
    category: 'React',
    severity: 'major',
    difficulty: 'Easy',
    points: 15,
    question: 'D-06',
    hint: 'props are read-only. React compares references, so an in-place splice means no re-render at all.',
    run: async (ctx) => {
      const src = file(ctx, 'client/src/components/TrackRow.jsx');
      ctx.expect(/\btracks\.(push|splice|sort|reverse|pop|shift|unshift|fill)\s*\(/.test(src)).toBe(false);
    },
  },
];

export const MODE_A_SUITE = {
  id: 'mode-a-debugging',
  mode: 'A',
  title: 'Vinyl delete-track regression suite',
  tests: MODE_A_TESTS,
};
