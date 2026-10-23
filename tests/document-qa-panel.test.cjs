require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const { DocumentQaPanel } = require('../components/student/document-qa-panel.tsx');
const { documentQaService } = require('../lib/document-qa-api.ts');
const { ApiError } = require('../lib/auth-api.ts');
const { QA_LIMIT_CODE, QA_QUEUE_CODE } = require('../lib/document-qa-view.ts');

const textOf = (node) => (typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf(node?.children ?? []));
const limits = (used, limit = 20) => ({ limit, used, remaining: Math.max(0, limit - used), resetsAt: used ? '2026-03-02T08:00:00Z' : null });
const citation = { marker: 1, documentName: 'Giải tích.pdf', page: 7, chunkIndex: 3, excerpt: 'Đạo hàm của hàm số y = x bằng 1' };
const answered = { id: 'm1', question: 'Đạo hàm của x là gì?', status: 'ANSWERED', answer: 'Đạo hàm của x bằng 1 [1]. Không có [4].', citations: [citation], createdAt: '2026-03-01T08:00:00Z' };
const refused = { id: 'm2', question: 'Thủ đô nước Pháp?', status: 'NOT_FOUND', answer: 'Tài liệu này không có thông tin để trả lời câu hỏi.', citations: [], createdAt: '2026-03-01T09:00:00Z' };

function stub(history, ask) {
  const calls = { ask: [], history: 0, limits: 0 };
  documentQaService.history = async () => { calls.history++; return history; };
  documentQaService.limits = async () => { calls.limits++; return calls.nextLimits ?? history.limits; };
  documentQaService.ask = async (kind, id, question, requestId, newConversation) => { calls.ask.push({ kind, id, question, requestId, newConversation }); return ask(calls.ask.length); };
  return calls;
}
async function mount(t, props = {}) {
  let renderer;
  await act(async () => { renderer = create(React.createElement(DocumentQaPanel, { kind: 'course', documentId: 'doc-1', sleep: async () => {}, ...props })); });
  await act(async () => {});
  t.after(() => act(async () => renderer.unmount()));
  return renderer;
}
const text = (r) => textOf(r.toJSON());
const field = (r) => r.root.findByType('textarea');
const write = (r, value) => act(async () => field(r).props.onChange({ target: { value } }));
const submit = (r) => act(async () => { await r.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
const history = (messages, used = messages.length) => ({ document: { id: 'doc-1', name: 'Giải tích.pdf', kind: 'COURSE' }, messages, limits: limits(used) });

test('earlier answers are shown with the passages they rely on', async (t) => {
  stub(history([answered, refused], 2), () => { throw new Error('unused'); });
  const r = await mount(t);
  const shown = text(r);
  assert.match(shown, /Đạo hàm của x là gì\?/);
  assert.match(shown, /Giải tích\.pdf · trang 7/);
  assert.match(shown, /Đạo hàm của hàm số y = x bằng 1/);
  assert.match(shown, /Còn 18\/20 lượt hỏi/);
  const markers = r.root.findAll((n) => n.type === 'a' && n.props['aria-label'] === 'Nguồn 1');
  assert.equal(markers.length, 1, 'only the real citation becomes a source link');
  assert.match(shown, /\[4\]/, 'an invented marker stays as plain text');
});

test('"not in the document" is shown as an honest result, not an answer', async (t) => {
  stub(history([refused]), () => { throw new Error('unused'); });
  const shown = text(await mount(t));
  assert.match(shown, /Tài liệu này không có thông tin để trả lời câu hỏi\./);
  assert.match(shown, /hỏi giáo viên/);
});

test('an empty history invites the first question', async (t) => {
  stub(history([], 0), () => { throw new Error('unused'); });
  assert.match(text(await mount(t)), /Chưa có câu hỏi nào/);
});

test('asking sends the trimmed question once, shows the answer and clears the box', async (t) => {
  const calls = stub(history([], 0), () => ({ message: answered, limits: limits(1) }));
  const r = await mount(t);
  await write(r, '   Đạo hàm của x là gì?   ');
  await submit(r);
  assert.equal(calls.ask.length, 1);
  assert.deepEqual({ kind: calls.ask[0].kind, id: calls.ask[0].id, question: calls.ask[0].question }, { kind: 'course', id: 'doc-1', question: 'Đạo hàm của x là gì?' });
  assert.match(calls.ask[0].requestId, /^[A-Za-z0-9_-]{8,100}$/);
  assert.match(text(r), /Giải tích\.pdf · trang 7/);
  assert.match(text(r), /Còn 19\/20/);
  assert.equal(field(r).props.value, '');
});

test('a second submit while a question is running is ignored', async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = stub(history([], 0), async () => { await gate; return { message: answered, limits: limits(1) }; });
  const r = await mount(t);
  await write(r, 'Đạo hàm của x là gì?');
  await act(async () => {
    const form = r.root.findByType('form');
    const first = form.props.onSubmit({ preventDefault() {} });
    await form.props.onSubmit({ preventDefault() {} });
    assert.equal(calls.ask.length, 1, 'the double click must not send a second question');
    release();
    await first;
  });
  assert.equal(calls.ask.length, 1);
});

test('too short a question is refused before anything is sent', async (t) => {
  const calls = stub(history([], 0), () => { throw new Error('unused'); });
  const r = await mount(t);
  await write(r, 'ab');
  await submit(r);
  assert.equal(calls.ask.length, 0);
  assert.match(text(r), /dài hơn/);
});

test('with no questions left the box is closed and nothing can be sent', async (t) => {
  const calls = stub({ ...history([answered], 20), limits: limits(20) }, () => { throw new Error('unused'); });
  const r = await mount(t);
  assert.equal(field(r).props.disabled, true);
  assert.match(text(r), /Đã dùng hết 20 lượt hỏi/);
  assert.match(text(r), /15:00/);
  await submit(r);
  assert.equal(calls.ask.length, 0);
});

test('when the server says the limit is reached, the message is shown and the allowance refreshed', async (t) => {
  const calls = stub(history([], 19), () => { throw new ApiError('Bạn đã dùng hết 20 lượt hỏi tài liệu trong 24 giờ.', 429, [], QA_LIMIT_CODE, 3600); });
  calls.nextLimits = limits(20);
  const r = await mount(t);
  await write(r, 'Một câu hỏi nữa');
  await submit(r);
  assert.match(text(r), /Bạn đã dùng hết 20 lượt hỏi tài liệu/);
  assert.equal(calls.limits, 1);
  await act(async () => {});
  assert.equal(field(r).props.disabled, true, 'the box closes once the allowance is known to be spent');
});

test('a failed question keeps the text and the next try gets a fresh request id', async (t) => {
  const calls = stub(history([], 0), (n) => { if (n === 1) throw new ApiError('Kết quả AI không đạt kiểm tra', 503); return { message: answered, limits: limits(1) }; });
  const r = await mount(t);
  await write(r, 'Đạo hàm của x là gì?');
  await submit(r);
  assert.match(text(r), /Kết quả AI không đạt kiểm tra/);
  assert.equal(field(r).props.value, 'Đạo hàm của x là gì?', 'the question is kept so it can be sent again');
  await submit(r);
  assert.equal(calls.ask.length, 2);
  assert.notEqual(calls.ask[0].requestId, calls.ask[1].requestId);
  assert.match(text(r), /Giải tích\.pdf · trang 7/);
});

test('a busy AI line is waited out automatically with the same request id', async (t) => {
  const calls = stub(history([], 0), (n) => { if (n < 3) throw new ApiError('Bạn đang ở vị trí 2 trong hàng đợi', 429, [], QA_QUEUE_CODE, 5); return { message: answered, limits: limits(1) }; });
  const r = await mount(t);
  await write(r, 'Đạo hàm của x là gì?');
  await submit(r);
  assert.equal(calls.ask.length, 3);
  assert.equal(new Set(calls.ask.map((c) => c.requestId)).size, 1, 'a retry must be the same request so it is never charged twice');
  assert.match(text(r), /Giải tích\.pdf · trang 7/);
  assert.doesNotMatch(text(r), /vị trí 2/, 'the waiting notice disappears once answered');
});

test('losing access to the document is explained instead of a blank panel', async (t) => {
  documentQaService.history = async () => { throw new ApiError('không có', 404); };
  documentQaService.limits = async () => limits(0);
  const r = await mount(t);
  assert.match(text(r), /không còn quyền/);
});

const fresh = (id, conversationId, minutesAgo = 5) => ({ ...answered, id, conversationId, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });
const button = (r, label) => r.root.findAllByType('button').find((b) => textOf(b.props.children) === label);

test('questions on different topics are separated, those on one topic are not', async (t) => {
  stub(history([fresh('a', 'c1', 30), fresh('b', 'c1', 20), fresh('c', 'c2', 10)], 3), () => { throw new Error('unused'); });
  const r = await mount(t);
  const separators = r.root.findAll((n) => n.props?.role === 'separator');
  assert.equal(separators.length, 1, 'only the change from c1 to c2 gets a divider');
});

test('a follow-up hint is shown while the conversation is still fresh', async (t) => {
  stub(history([fresh('a', 'c1', 5)], 1), () => { throw new Error('unused'); });
  const r = await mount(t);
  assert.match(text(r), /còn ví dụ thì sao/);
  assert.ok(button(r, 'Chủ đề mới'), 'a recent conversation can be left');
});

test('an old conversation offers neither a hint nor a topic switch', async (t) => {
  stub(history([fresh('a', 'c1', 60 * 5)], 1), () => { throw new Error('unused'); });
  const r = await mount(t);
  assert.doesNotMatch(text(r), /còn ví dụ thì sao/);
  assert.equal(button(r, 'Chủ đề mới'), undefined);
});

test('starting a new topic is sent once and then the conversation continues again', async (t) => {
  const calls = stub(history([fresh('a', 'c1', 5)], 1), (n) => ({ message: fresh(`n${n}`, n === 1 ? 'c2' : 'c2', 0), limits: limits(1 + n) }));
  const r = await mount(t);
  await act(async () => button(r, 'Chủ đề mới').props.onClick());
  assert.match(text(r), /bắt đầu chủ đề mới/);
  assert.equal(button(r, 'Tiếp tục chủ đề cũ').props['aria-pressed'], true);
  await write(r, 'Một vấn đề khác hẳn');
  await submit(r);
  assert.equal(calls.ask[0].newConversation, true);
  assert.doesNotMatch(text(r), /bắt đầu chủ đề mới/, 'the switch is used up by that question');
  await write(r, 'Còn ví dụ thì sao?');
  await submit(r);
  assert.equal(calls.ask[1].newConversation, false, 'later questions follow the new topic');
});

test('a normal question does not ask for a new conversation', async (t) => {
  const calls = stub(history([fresh('a', 'c1', 5)], 1), () => ({ message: fresh('b', 'c1', 0), limits: limits(2) }));
  const r = await mount(t);
  await write(r, 'Còn ví dụ thì sao?');
  await submit(r);
  assert.equal(calls.ask[0].newConversation, false);
});

test('the topic switch survives a failed question', async (t) => {
  const calls = stub(history([fresh('a', 'c1', 5)], 1), (n) => { if (n === 1) throw new ApiError('Lỗi tạm thời', 503); return { message: fresh('b', 'c2', 0), limits: limits(2) }; });
  const r = await mount(t);
  await act(async () => button(r, 'Chủ đề mới').props.onClick());
  await write(r, 'Một vấn đề khác hẳn');
  await submit(r);
  assert.match(text(r), /Lỗi tạm thời/);
  await submit(r);
  assert.deepEqual(calls.ask.map((c) => c.newConversation), [true, true], 'the retry must still start a new topic');
});
