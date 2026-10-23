require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const view = require('../lib/document-qa-view.ts');
const api = require('../lib/document-qa-api.ts');
const { ApiError } = require('../lib/auth-api.ts');

test('markers become citations only when that citation exists', () => {
  const parts = view.answerParts('Đạo hàm bằng 1 [1]. Giới hạn bằng 0 [2]. Còn [9] thì không có.', 2);
  assert.deepEqual(parts.filter((p) => p.kind === 'marker').map((p) => p.marker), [1, 2]);
  assert.equal(parts.map((p) => (p.kind === 'text' ? p.text : `[${p.marker}]`)).join(''), 'Đạo hàm bằng 1 [1]. Giới hạn bằng 0 [2]. Còn [9] thì không có.');
});

test('an answer without citations is plain text, even if it contains brackets', () => {
  assert.deepEqual(view.answerParts('Không có nguồn [1]', 0), [{ kind: 'text', text: 'Không có nguồn [1]' }]);
  assert.deepEqual(view.answerParts('', 3), []);
  assert.deepEqual(view.answerParts('[0] [3]', 2), [{ kind: 'text', text: '[0] [3]' }]);
});

test('questions are trimmed and bounded by characters', () => {
  assert.deepEqual(view.checkQuestion('  Đạo hàm là gì?  '), { ok: true, question: 'Đạo hàm là gì?' });
  assert.equal(view.checkQuestion('ab').ok, false);
  assert.equal(view.checkQuestion('   ').ok, false);
  assert.equal(view.checkQuestion('ạ'.repeat(view.MAX_QUESTION_LENGTH)).ok, true);
  const long = view.checkQuestion('ạ'.repeat(view.MAX_QUESTION_LENGTH + 1));
  assert.equal(long.ok, false);
  assert.match(long.reason, /1000/);
});

test('the allowance is summarised, with the reopening time once it is used up', () => {
  assert.equal(view.limitSummary(null), '');
  assert.equal(view.limitSummary({ limit: 20, used: 3, remaining: 17, resetsAt: null }), 'Còn 17/20 lượt hỏi trong 24 giờ');
  const spent = view.limitSummary({ limit: 3, used: 3, remaining: 0, resetsAt: '2026-03-02T08:00:00Z' });
  assert.match(spent, /Đã dùng hết 3 lượt hỏi/);
  assert.match(spent, /15:00/, '08:00 UTC is 15:00 in Vietnam');
  assert.equal(view.limitSummary({ limit: 3, used: 3, remaining: 0, resetsAt: null }), 'Đã dùng hết 3 lượt hỏi');
  assert.equal(view.resetLabel('không phải ngày'), '');
});

test('request ids are unique and long enough for the server', () => {
  const ids = new Set(Array.from({ length: 50 }, () => view.newRequestId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{8,100}$/);
});

test('errors are turned into messages the student can act on', () => {
  const limit = new ApiError('Bạn đã dùng hết 20 lượt', 429, [], view.QA_LIMIT_CODE, 3600);
  assert.deepEqual(view.qaErrorMessage(limit), { message: 'Bạn đã dùng hết 20 lượt', limitReached: true });
  assert.equal(view.qaErrorMessage(new ApiError('x', 404)).limitReached, false);
  assert.match(view.qaErrorMessage(new ApiError('x', 404)).message, /không còn quyền/);
  assert.equal(view.qaErrorMessage(new ApiError('Máy chủ lỗi', 503)).message, 'Máy chủ lỗi');
  assert.equal(view.qaErrorMessage(new Error('mất mạng')).message, 'mất mạng');
  assert.match(view.qaErrorMessage('lạ').message, /Không thể gửi/);
});

const result = { message: { id: 'm1' }, limits: { limit: 20, used: 1, remaining: 19, resetsAt: null } };
const busy = (seconds) => new ApiError('Bạn đang ở vị trí 2', 429, [], view.QA_QUEUE_CODE, seconds);

test('a full AI line is waited out with the same request, then answered', async () => {
  const waits = [], notices = [];
  let calls = 0;
  const got = await api.askWithQueueRetry(async () => { if (++calls < 3) throw busy(12); return result; }, {
    sleep: async (ms) => { waits.push(ms); }, onQueued: (n) => notices.push(n.attempt),
  });
  assert.equal(got, result);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [12000, 12000]);
  assert.deepEqual(notices, [1, 2]);
});

test('waiting is clamped and gives up after the retry budget', async () => {
  const waits = [];
  let calls = 0;
  await assert.rejects(api.askWithQueueRetry(async () => { calls++; throw busy(calls === 1 ? 0 : 9999); }, { maxQueueRetries: 2, sleep: async (ms) => { waits.push(ms); } }), (e) => e.code === view.QA_QUEUE_CODE);
  assert.deepEqual(waits, [3000, 60000]);
  assert.equal(calls, 3);
});

test('the question limit and other failures are never retried', async () => {
  for (const failure of [new ApiError('hết lượt', 429, [], view.QA_LIMIT_CODE, 60), new ApiError('chung', 429, [], 'RATE_LIMITED', 60), new ApiError('lỗi', 503), new Error('mạng')]) {
    let calls = 0;
    await assert.rejects(api.askWithQueueRetry(async () => { calls++; throw failure; }, { sleep: async () => {} }), (e) => e === failure);
    assert.equal(calls, 1);
  }
});

const msg = (conversationId, minutesAgo) => ({ id: conversationId + minutesAgo, conversationId, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });

test('conversation breaks are marked where the topic changes', () => {
  assert.deepEqual(view.conversationBreaks([]), []);
  assert.deepEqual(view.conversationBreaks([msg('a', 9), msg('a', 8), msg('b', 7), msg('b', 6), msg('a', 5)]), [false, false, true, false, true]);
});

test('a conversation continues for two hours after the last answer', () => {
  const now = Date.now();
  assert.equal(view.continuesConversation([], now), false);
  assert.equal(view.continuesConversation([msg('a', 119)], now), true);
  assert.equal(view.continuesConversation([msg('a', 120)], now), false);
  assert.equal(view.continuesConversation([{ conversationId: 'a', createdAt: 'không phải ngày' }], now), false);
});

test('the hint says what the next question will be read against', () => {
  assert.equal(view.conversationHint([], false), '');
  assert.match(view.conversationHint([msg('a', 5)], false), /3 câu gần nhất/);
  assert.match(view.conversationHint([msg('a', 5)], true), /chủ đề mới/);
  assert.equal(view.conversationHint([msg('a', 500)], false), '');
});
