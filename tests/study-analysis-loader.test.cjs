const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

class ApiError extends Error {
  constructor(message, status, details = [], code, retryAfterSeconds) {
    super(message);
    this.status = status; this.details = details; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
  }
}

function loader(service) {
  return loadTypeScript('lib/study-analysis-loader.ts', (id) => {
    if (id === '@/lib/assessment-api') return { examAttemptService: service };
    if (id === '@/lib/auth-api') return { ApiError };
    throw new Error(`unexpected import ${id}`);
  });
}

const busy = (seconds = 20) => new ApiError('Bạn đang ở vị trí 3', 429, [], 'AI_QUEUE_BUSY', seconds);
const analysis = { id: 'analysis' };

test('an existing analysis is returned without creating a new one', async () => {
  let created = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => analysis,
    createStudyAnalysis: async () => { created++; return analysis; },
  });
  assert.equal(await loadOrCreateStudentStudyAnalysis('a'), analysis);
  assert.equal(created, 0);
});

test('a missing analysis is created once', async () => {
  let creating = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => { throw new ApiError('none', 404); },
    createStudyAnalysis: async () => analysis,
  });
  assert.equal(await loadOrCreateStudentStudyAnalysis('a', () => creating++), analysis);
  assert.equal(creating, 1);
});

test('when the AI line is full the student waits and retries automatically', async () => {
  const waits = [], notices = [];
  let calls = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => { throw new ApiError('none', 404); },
    createStudyAnalysis: async () => {
      if (++calls < 3) throw busy(20);
      return analysis;
    },
  });
  const result = await loadOrCreateStudentStudyAnalysis('a', undefined, (n) => notices.push(n), {
    sleep: async (ms) => { waits.push(ms); },
  });
  assert.equal(result, analysis);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [20_000, 20_000], 'waits for the time the server suggested');
  assert.deepEqual(notices.map((n) => n.attempt), [1, 2]);
  assert.match(notices[0].message, /vị trí 3/);
});

test('waiting time is clamped so a bad header cannot spam or freeze the page', async () => {
  const waits = [];
  let calls = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => { throw new ApiError('none', 404); },
    createStudyAnalysis: async () => {
      calls++;
      if (calls === 1) throw busy(0);
      if (calls === 2) throw busy(9999);
      if (calls === 3) throw new ApiError('busy', 429, [], 'AI_QUEUE_BUSY');
      return analysis;
    },
  });
  await loadOrCreateStudentStudyAnalysis('a', undefined, undefined, { sleep: async (ms) => { waits.push(ms); } });
  assert.deepEqual(waits, [3_000, 60_000, 10_000]);
});

test('it gives up after the retry budget and shows the server message', async () => {
  let calls = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => { throw new ApiError('none', 404); },
    createStudyAnalysis: async () => { calls++; throw busy(5); },
  });
  await assert.rejects(
    loadOrCreateStudentStudyAnalysis('a', undefined, undefined, { maxQueueRetries: 2, sleep: async () => {} }),
    (error) => error.status === 429 && /vị trí 3/.test(error.message),
  );
  assert.equal(calls, 3, 'first try plus two retries');
});

test('ordinary rate limiting and other failures are not retried', async () => {
  for (const failure of [
    new ApiError('Quá nhiều yêu cầu', 429, [], 'RATE_LIMITED', 60),
    new ApiError('Lỗi máy chủ', 500),
    new ApiError('Không có quyền', 403),
  ]) {
    let calls = 0;
    const { loadOrCreateStudentStudyAnalysis } = loader({
      getStudyAnalysis: async () => { throw new ApiError('none', 404); },
      createStudyAnalysis: async () => { calls++; throw failure; },
    });
    await assert.rejects(loadOrCreateStudentStudyAnalysis('a', undefined, undefined, { sleep: async () => {} }), (e) => e === failure);
    assert.equal(calls, 1);
  }
});

test('errors while reading the existing analysis are not turned into a create', async () => {
  let created = 0;
  const { loadOrCreateStudentStudyAnalysis } = loader({
    getStudyAnalysis: async () => { throw new ApiError('Máy chủ lỗi', 500); },
    createStudyAnalysis: async () => { created++; return analysis; },
  });
  await assert.rejects(loadOrCreateStudentStudyAnalysis('a'), (e) => e.status === 500);
  assert.equal(created, 0);
});

test('Retry-After parsing accepts only plain seconds', () => {
  const { parseRetryAfter } = loadTypeScript('lib/auth-api.ts', (id) => {
    if (id === 'node:module') return require(id);
    return new Proxy({}, { get: () => () => undefined });
  });
  assert.equal(parseRetryAfter('20'), 20);
  assert.equal(parseRetryAfter(' 7 '), 7);
  for (const bad of [null, '', 'abc', '-5', '1.5', 'Wed, 21 Oct 2026 07:28:00 GMT', '123456']) {
    assert.equal(parseRetryAfter(bad), undefined, String(bad));
  }
});
