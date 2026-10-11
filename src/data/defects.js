/**
 * Known defect signatures per repository.
 *
 * Two jobs:
 *  1. power the assistant's "which files have errors?" answer with direct, clickable paths
 *  2. drive the "reported issues" list in the round brief
 *
 * `signature` is matched against comment-stripped source, so a candidate who has already
 * fixed a defect stops being pointed at it.
 */

export const DEFECTS = {
  A: [
    {
      id: 'A-D1',
      file: 'server/services/libraryService.js',
      area: 'Correctness',
      difficulty: 'Easy',
      question: 'D-01',
      test: 'A-01',
      summary: 'Deleting a track that is not in your library removes an unrelated row.',
      detail:
        'Array.prototype.splice with a negative index counts backwards from the end of the array, so index -1 silently drops the last entry before the code notices it failed.',
      signature: /db\.library\.splice\(index, 1\);\s*\n\s*if\s*\(index === -1\)/,
    },
    {
      id: 'A-D2',
      file: 'server/middleware/auth.js',
      area: 'Express',
      difficulty: 'Easy',
      question: 'D-02',
      test: 'A-02',
      summary: 'Every authenticated request is rejected, so delete appears to fail.',
      detail:
        'The bearer-token lookup reads req.headers with the wrong casing — Node lower-cases every incoming header name.',
      signature: /req\.headers\.Authorization/,
    },
    {
      id: 'A-D3',
      file: 'server/middleware/auth.js',
      area: 'Express',
      difficulty: 'Easy',
      question: 'D-02',
      test: 'A-02',
      summary: 'The middleware returns without calling next().',
      detail: 'Express stops at a layer that neither responds nor continues the chain.',
      signature: /req\.user = \{ id: user\.id, name: user\.name, role: user\.role \};\s*\n\}/,
    },
    {
      id: 'A-D4',
      file: 'server/routes/tracks.js',
      area: 'API',
      difficulty: 'Moderate',
      question: 'D-03',
      test: 'A-03',
      hint: 'A rejection with no handler becomes a 500.',
      detail:
        'The delete handler awaits work that throws for a track outside the library, and nothing translates that into an HTTP status.',
      signature: /router\.delete\('\/:\id',\s*async \(req, res\)/,
    },
    {
      id: 'A-D5',
      file: 'client/src/api/client.js',
      area: 'Error Handling',
      difficulty: 'Easy',
      question: 'D-05',
      test: 'A-05',
      summary: 'deleteTrack resolves successfully even when the server returned an error.',
      detail: 'response.json() succeeds on a 404/500 body, so the failure never reaches the caller.',
      signature: /return response\.json\(\);\s*\n\}/,
    },
    {
      id: 'A-D6',
      file: 'client/src/components/TrackRow.jsx',
      area: 'React',
      difficulty: 'Easy',
      question: 'D-06',
      test: 'A-06',
      summary: 'The row mutates the tracks array it was given, so React never re-renders.',
      detail: 'React compares references; an in-place splice leaves the reference unchanged.',
      signature: /\btracks\.(push|splice|sort|reverse|pop|shift|unshift|fill)\s*\(/,
    },
  ],

  B: [
    {
      id: 'B-D1',
      file: 'server/services/awardService.js',
      area: 'Feature',
      difficulty: 'Easy',
      question: 'F-01',
      test: 'B-01',
      summary: 'The awards section is served from a hard-coded array.',
      detail:
        'MOCK_AWARDS is returned verbatim. db.awards already holds seven real records — including ceremonies the mock array never had.',
      signature: /return MOCK_AWARDS\.filter/,
    },
    {
      id: 'B-D2',
      file: 'server/routes/awards.js',
      area: 'API',
      difficulty: 'Easy',
      question: 'F-02',
      test: 'B-02',
      summary: 'An unknown movie id is answered with an empty list rather than a 404.',
      detail: 'The route never checks that the movie exists before returning its awards.',
      signature: /res\.json\(\{ data: rows, source: 'mock' \}\)/,
    },
    {
      id: 'B-D3',
      file: 'server/routes/auth.js',
      area: 'Authentication',
      difficulty: 'Easy',
      question: 'F-03',
      test: 'B-03',
      summary: 'Login issues a token without checking anything.',
      detail: 'Any body at all — including an empty one — receives a token and a hard-coded user.',
      signature: /res\.json\(\{\s*token: 'development-token'/,
    },
    {
      id: 'B-D4',
      file: 'server/middleware/authenticate.js',
      area: 'Authentication',
      difficulty: 'Easy',
      question: 'F-04',
      test: 'B-04',
      summary: 'Authentication trusts a literal identity instead of the request.',
      detail: 'req.user is assigned a constant, so the Authorization header is never read.',
      signature: /req\.user = \{ id: 'u_member', role: 'member'/,
    },
    {
      id: 'B-D5',
      file: 'server/middleware/authorize.js',
      area: 'Authorisation',
      difficulty: 'Moderate',
      question: 'F-05',
      test: 'B-05',
      summary: 'There is no role guard anywhere in the project.',
      detail: 'The file does not exist, so nominations can be created by anyone who reaches the route.',
      signature: null,
      missing: true,
    },
    {
      id: 'B-D6',
      file: 'server/app.js',
      area: 'Resilience',
      difficulty: 'Easy',
      question: 'F-06',
      test: 'B-05',
      summary: 'The app has no terminal error handler, so every typed error becomes a 500.',
      detail:
        'server/utils/errors.js already carries status codes; nothing consumes them. Once you start using next(err), you need the four-argument layer.',
      // present => defect fixed; absent => defect still open
      absent: /\(\s*err(or)?\b[^)]*,\s*req\b[^)]*,\s*res\b[^)]*,\s*next\s*\)\s*=>/,
    },
    {
      id: 'B-D7',
      file: 'client/src/utils/permissions.js',
      area: 'Client',
      difficulty: 'Easy',
      question: 'F-06',
      test: 'B-06',
      summary: 'There is no shared permission helper.',
      detail: 'Every component has to inline its own role check, and none of them are testable.',
      signature: null,
      missing: true,
    },
  ],
};

/** Files whose known-defect signature is still present in the candidate's working tree. */
export function scanDefects(mode, files) {
  const list = DEFECTS[mode] ?? [];
  const seen = new Set();

  return list.filter((defect) => {
    if (seen.has(defect.file)) return false;
    const source = files?.[defect.file];
    const isOpen = (hit) => {
      seen.add(defect.file);
      return hit;
    };

    if (defect.missing) {
      return isOpen(!(typeof source === 'string' && source.trim().length > 0));
    }
    if (typeof source !== 'string') return false;
    if (defect.absent) return isOpen(!defect.absent.test(source));
    if (defect.signature) return isOpen(defect.signature.test(source));
    return false;
  });
}

/** How many distinct files still have at least one open problem. */
export function fixedCount(mode, files) {
  const total = [...new Set((DEFECTS[mode] ?? []).map((d) => d.file))].length;
  return total - scanDefects(mode, files).length;
}
