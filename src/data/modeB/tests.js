/**
 * ROUND 2 — graded assertions for the feature-development round.
 *
 * Six assertions, easy → moderate. Together they cover the spine of the story: make the
 * awards section real, then put an account and a permission layer in front of it.
 */

import { findExportedNames } from '../../lib/staticAnalysis.js';

export const MODE_B_SEED = {
  tokens: {
    admin: 'cv_admin_0001',
    curator: 'cv_curator_0002',
    member: 'cv_member_0003',
  },
  credentials: {
    admin: { email: 'dana@cinevault.tv', password: 'admin123' },
    curator: { email: 'luis@cinevault.tv', password: 'curator123' },
    member: { email: 'mina@cinevault.tv', password: 'member123' },
  },
};

export const MODE_B_MOCKS = {
  cors: () => (_req, _res, next) => next(),
  helmet: () => (_req, _res, next) => next(),
  morgan: () => (_req, _res, next) => next(),
  bcrypt: {
    compare: async (plain, hash) => String(hash) === String(plain),
    hash: async (plain) => String(plain),
  },
};

const APP = { appFactory: { path: 'server/app.js', export: 'createApp' } };
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const silentRes = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const file = (ctx, path) => {
  if (!ctx.exists(path)) ctx.expect.fail(`Expected file ${path} to exist in the repository.`);
  return ctx.read(path);
};

export const MODE_B_TESTS = [
  {
    id: 'B-01',
    title: 'awardService reads from the store instead of the mock array',
    file: 'server/services/awardService.js',
    kind: 'runtime',
    category: 'Feature',
    severity: 'critical',
    difficulty: 'Easy',
    points: 15,
    question: 'F-01',
    hint: 'db.awards already holds the rows, including ones the mock array never had.',
    run: async (ctx) => {
      const service = ctx.load('server/services/awardService.js');
      const db = ctx.load('server/db.js');

      const forMovie = service.listForMovie('mv_101');
      const expected = db.awards.filter((row) => row.movieId === 'mv_101');

      ctx.expect(Array.isArray(forMovie)).toBe(true);
      ctx.expect(forMovie).toHaveLength(expected.length);
      ctx.expect(forMovie).toHaveLength(3);
      forMovie.forEach((row) => {
        ctx.expect(String(row.id).indexOf('mock')).toBe(-1);
        ctx.expect(expected.some((e) => e.id === row.id)).toBe(true);
      });

      ctx.expect(service.listForMovie('mv_104')).toHaveLength(1);
      ctx.expect(service.listForMovie('mv_9999')).toHaveLength(0);
    },
  },

  {
    id: 'B-02',
    title: 'GET /api/awards/:movieId serves real records and 404s an unknown movie',
    file: 'server/routes/awards.js',
    kind: 'integration',
    category: 'Feature',
    severity: 'major',
    difficulty: 'Easy',
    points: 15,
    question: 'F-02',
    ...APP,
    hint: 'Keep the { data } envelope. Drop the "source": "mock" marker once it is genuinely real.',
    run: async (ctx) => {
      const ok = await ctx.api.get('/api/awards/mv_101');
      ctx.expect(ok.status).toBe(200);
      ctx.expect(ok.body?.data).toHaveLength(3);
      ok.body.data.forEach((row) => ctx.expect(String(row.id).indexOf('mock')).toBe(-1));

      const missing = await ctx.api.get('/api/awards/mv_9999');
      ctx.expect(missing.status).toBe(404);
    },
  },

  {
    id: 'B-03',
    title: 'POST /api/auth/login issues a token for valid credentials',
    file: 'server/routes/auth.js',
    kind: 'integration',
    category: 'Authentication',
    severity: 'major',
    difficulty: 'Easy',
    points: 15,
    question: 'F-03',
    ...APP,
    hint: 'db.findUserByEmail already exists. One message for both wrong-password and unknown-user.',
    run: async (ctx) => {
      const ok = await ctx.api.post('/api/auth/login', MODE_B_SEED.credentials.curator);
      ctx.expect(ok.status).toBe(200);
      ctx.expect(typeof ok.body?.token).toBe('string');
      ctx.expect(ok.body?.user?.role).toBe('curator');

      const wrong = await ctx.api.post('/api/auth/login', {
        email: MODE_B_SEED.credentials.curator.email,
        password: 'nope',
      });
      ctx.expect(wrong.status).toBe(401);

      const missing = await ctx.api.post('/api/auth/login', { email: MODE_B_SEED.credentials.member.email });
      ctx.expect(missing.status).toBe(400);
    },
  },

  {
    id: 'B-04',
    title: 'Protected award routes reject anonymous and unknown tokens with 401',
    file: 'server/middleware/authenticate.js',
    kind: 'integration',
    category: 'Authentication',
    severity: 'critical',
    difficulty: 'Easy',
    points: 15,
    question: 'F-04',
    ...APP,
    hint: 'Read the header, split the Bearer scheme, resolve the token — then continue the chain.',
    run: async (ctx) => {
      const anonymous = await ctx.api.post('/api/awards/mv_101', { category: 'Best Film' });
      ctx.expect(anonymous.status).toBe(401);

      const bogus = await ctx.api.post(
        '/api/awards/mv_101',
        { category: 'Best Film' },
        auth('not-a-real-token'),
      );
      ctx.expect(bogus.status).toBe(401);

      const curator = await ctx.api.post(
        '/api/awards/mv_101',
        { ceremony: 'Aurora Awards', category: 'Best Film', year: 2026, recipient: 'Luis Ferreira' },
        auth(MODE_B_SEED.tokens.curator),
      );
      ctx.expect(curator.status).toBe(201);
      ctx.expect(curator.body?.data?.id).toBeDefined();
    },
  },

  {
    id: 'B-05',
    title: 'Adding a nomination is restricted to curators and admins',
    file: 'server/middleware/authorize.js',
    kind: 'integration',
    category: 'Authorisation',
    severity: 'critical',
    difficulty: 'Moderate',
    points: 20,
    question: 'F-05',
    ...APP,
    hint: 'Export authorize(...roles). "I do not know you" is 401; "I know, and the answer is no" is 403.',
    run: async (ctx) => {
      const asMember = await ctx.api.post(
        '/api/awards/mv_101',
        { ceremony: 'Aurora Awards', category: 'Best Film', year: 2026, recipient: 'Mina Haddad' },
        auth(MODE_B_SEED.tokens.member),
      );
      ctx.expect(asMember.status).toBe(403);

      const asAdmin = await ctx.api.post(
        '/api/awards/mv_102',
        { ceremony: 'Aurora Awards', category: 'Best Film', year: 2026, recipient: 'Dana Okoro' },
        auth(MODE_B_SEED.tokens.admin),
      );
      ctx.expect(asAdmin.status).toBe(201);

      // the guard must be a factory, not a one-off middleware
      const mod = ctx.load('server/middleware/authorize.js');
      const factory = mod.authorize ?? mod.default;
      ctx.expect(typeof factory).toBe('function');

      const res = silentRes();
      let forwarded;
      let called = false;
      await factory('curator')({ user: { id: 'u_member', role: 'member' } }, res, (err) => {
        called = true;
        forwarded = err;
      });
      ctx.expect(called ? (forwarded?.status ?? 500) : res.statusCode).toBe(403);
    },
  },

  {
    id: 'B-06',
    title: 'client/src/utils/permissions.js exposes a pure can() helper',
    file: 'client/src/utils/permissions.js',
    kind: 'runtime',
    category: 'Client',
    severity: 'minor',
    difficulty: 'Easy',
    points: 20,
    question: 'F-06',
    hint: 'can(user, action, movie) → boolean. No React import — that is what keeps it unit-testable.',
    run: async (ctx) => {
      const source = file(ctx, 'client/src/utils/permissions.js');
      ctx.expect(findExportedNames(source)).toContain('can');

      const mod = ctx.load('client/src/utils/permissions.js');
      const can = mod.can ?? mod.default?.can;
      ctx.expect(typeof can).toBe('function');

      const admin = { id: 'u_admin', role: 'admin' };
      const curator = { id: 'u_curator', role: 'curator' };
      const member = { id: 'u_member', role: 'member' };
      const movie = { id: 'mv_101', title: 'The Long Signal' };

      ctx.expect(can(admin, 'award.nominate', movie)).toBe(true);
      ctx.expect(can(curator, 'award.nominate', movie)).toBe(true);
      ctx.expect(can(member, 'award.nominate', movie)).toBe(false);
      ctx.expect(can(member, 'award.view', movie)).toBe(true);
      ctx.expect(can(admin, 'award.view', movie)).toBe(true);
      ctx.expect(can(null, 'award.view', movie)).toBe(false);
      ctx.expect(can(member, 'award.view', null)).toBe(true);
    },
  },
];

export const MODE_B_SUITE = {
  id: 'mode-b-feature',
  mode: 'B',
  title: 'CineVault awards acceptance suite',
  tests: MODE_B_TESTS,
};
