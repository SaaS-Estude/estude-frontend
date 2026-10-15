/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
const childText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(childText).join('') : React.isValidElement(value) ? childText(value.props.children) : '';
const question = (id, status = 'PENDING') => ({ id, status, content: `Nội dung ${id}`, difficulty: 'MEDIUM',
  options: [{ id: 'a', label: 'A', text: 'Đáp án' }], correctOptionIds: ['a'], explanation: 'Giải thích',
  source: { documentName: 'Toán.pdf', page: 1 }, type: 'SINGLE_CHOICE' });

async function render(t, options = {}) {
  const calls = [];
  const questions = options.questions ?? [question('q1'), question('q2')];
  const previousWindow = global.window;
  if (options.folderId) global.window = { location: { search: `?folderId=${options.folderId}` } };
  t.after(() => { global.window = previousWindow; });
  const filename = path.resolve('components/assessment/ai-question-generator-page.tsx');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === './unsaved-question-changes') return { UnsavedQuestionChanges: ({ dirty }) => React.createElement('span', { 'data-unsaved-guard': dirty }) };
    if (id === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => React.createElement('svg') });
    if (id === '@/components/assessment/assessment-shell') return {
      AssessmentShell: ({ children }) => React.createElement('main', null, children),
      ErrorPanel: ({ message }) => React.createElement('p', { role: 'alert' }, message),
      LoadingPanel: () => React.createElement('p', null, 'loading'), PageHeading: () => null,
    };
    if (id === '@/components/ui/button') return { Button: ({ permission, children, ...props }) =>
      permission === 'ai_questions.approve' && options.allowed === false ? null : React.createElement('button', props, children) };
    if (id === '@/components/ui/form-control') return {
      CustomSelect: () => null, Input: (props) => React.createElement('input', props), Textarea: (props) => React.createElement('textarea', props),
    };
    if (id === '@/components/ui/toggle-switch') return { ToggleSwitch: () => null };
    if (id === '@/lib/subject-localization') return { getVietnameseSubjectName: (value) => value };
    if (id === '@/lib/assessment-api') return {
      academicDataService: { getMaterialLibrary: async () => [{ id: 'material', originalName: 'Toán.pdf', mimeType: 'application/pdf' }], getSubjects: async () => [] },
      questionBankService: { getFolders: async () => [{ id: 'folder', name: 'Lịch sử' }] },
      aiQuestionSettingsService: { getMine: async () => ({ effectiveLevels: [{ code: 'MEDIUM', label: 'Trung bình', description: 'Vận dụng' }], defaultQuantity: questions.length }) },
      aiQuestionService: {
        getDraft: async () => options.storedDraft ?? null,
        saveDraft: async (payload) => { calls.push({ draft: payload }); if (options.saveFailure) throw new Error('Không lưu được bản nháp'); return { version: (options.storedDraft?.version ?? 0) + 1, savedAt: '2026-09-26T10:00:00Z' }; },
        update: async (id, draft) => { options.validateUpdate?.(draft); if (options.updateFailure) throw new Error('Đáp án chưa hợp lệ'); return { ...questions.find((q) => q.id === id), ...draft }; },
        generate: async () => questions,
        approveMany: async (ids, folderId) => {
          calls.push({ approveMany: ids, ...(folderId ? { folderId } : {}) });
          if (options.wait) await options.wait;
          if (options.fail && ids.includes(options.fail)) throw new Error('Cần chỉnh sửa đáp án');
          return ids.map((id) => ({ generatedQuestion: { ...questions.find((q) => q.id === id), status: 'APPROVED' }, question: { id: `bank-${id}` } }));
        },
        approve: async () => { throw new Error('Bulk approval must use one request'); },
      },
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  let renderer;
  await act(async () => { const page = React.createElement(loaded.exports.AiQuestionGeneratorPage); renderer = create(options.strict ? React.createElement(React.StrictMode, null, page) : page); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  if (options.generate !== false) await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  const button = (label) => renderer.root.findAllByType('button').find((b) => childText(b.props.children).includes(label));
  const approveAll = async () => { await act(async () => { button('Duyệt tất cả').props.onClick(); await flush(); }); };
  const leaveGuard = () => renderer.root.findByProps({ 'data-unsaved-guard': true });
  return { renderer, calls, button, approveAll, leaveGuard, text: () => JSON.stringify(renderer.toJSON()) };
}

test('approves only pending questions and disables the batch button when none remain', async (t) => {
  const page = await render(t, { questions: [question('q1'), question('approved', 'APPROVED'), question('rejected', 'REJECTED'), question('q2')] });
  assert.match(childText(page.button('Duyệt tất cả').props.children), /\(2\)/);
  await page.approveAll();
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.match(page.text(), /Đã duyệt 2 câu vào ngân hàng/);
});

test('does not warn on navigation after all generated questions have been approved', async (t) => {
  const page = await render(t);
  assert.equal(page.leaveGuard().props['data-unsaved-guard'], true);
  await page.approveAll();
  assert.equal(page.renderer.root.findAllByProps({ 'data-unsaved-guard': true }).length, 0);
  assert.match(page.text(), /Tất cả câu hỏi đã vào ngân hàng/);
  assert.doesNotMatch(page.text(), /Có thay đổi chưa lưu/);
});

test('keeps the leave warning when approval fails and questions remain pending', async (t) => {
  const page = await render(t, { fail: 'q2' });
  await page.approveAll();
  assert.equal(page.leaveGuard().props['data-unsaved-guard'], true);
  assert.match(page.text(), /Có thay đổi chưa lưu/);
});

test('retains the full pending batch after failure and retries it with one request', async (t) => {
  const options = { fail: 'q2' }; const page = await render(t, options);
  await page.approveAll(); assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.match(page.text(), /Chưa duyệt được bộ câu hỏi/); assert.match(page.text(), /Cần chỉnh sửa đáp án/);
  assert.match(childText(page.button('Duyệt tất cả').props.children), /\(2\)/);
  options.fail = undefined;
  await page.approveAll(); assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }, { approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
});

test('blocks duplicate batch clicks, per-question actions and generation while approving', async (t) => {
  let release; const wait = new Promise((resolve) => { release = resolve; });
  const page = await render(t, { wait });
  await act(async () => {
    const click = page.button('Duyệt tất cả').props.onClick;
    click(); click(); await flush();
  });
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
  assert.equal(page.button('Đang duyệt').props.disabled, true);
  assert.equal(page.button('Duyệt vào ngân hàng').props.disabled, true);
  assert.equal(page.button('Tạo câu hỏi').props.disabled, true);
  await act(async () => { release(); await flush(); });
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'] }]);
});

test('requires finishing an unsaved edit before batch approval', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Sửa').props.onClick());
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.match(page.text(), /Hoàn tất chỉnh sửa/);
  await page.approveAll(); assert.deepEqual(page.calls, []);
  await act(async () => page.button('Hủy').props.onClick());
  assert.equal(page.button('Duyệt tất cả').props.disabled, false);
});

test('does not offer batch approval without the approval permission', async (t) => {
  const page = await render(t, { allowed: false });
  assert.equal(page.button('Duyệt tất cả'), undefined);
  assert.deepEqual(page.calls, []);
});

test('approves generated questions into the folder opened from the question bank', async (t) => {
  const page = await render(t, { folderId: 'folder' });
  assert.match(page.text(), /thư mục/);
  assert.match(page.text(), /Lịch sử/);
  await page.approveAll();
  assert.deepEqual(page.calls, [{ approveMany: ['q1', 'q2'], folderId: 'folder' }]);
});

test('saves configuration, pending question ids and unfinished edits without approving', async (t) => {
  const page = await render(t);
  await act(async () => page.button('Sửa').props.onClick());
  const editor = page.renderer.root.findAllByType('textarea').find((node) => node.props.value === 'Nội dung q1');
  await act(async () => editor.props.onChange({ target: { value: 'Bản sửa chưa hoàn tất' } }));
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.equal(page.calls.length, 1);
  assert.deepEqual(page.calls[0].draft.questionIds, ['q1', 'q2']);
  assert.equal(page.calls[0].draft.edits[0].content, 'Bản sửa chưa hoàn tất');
  assert.equal(page.calls[0].draft.expectedVersion, 0);
  assert.match(page.text(), /Đã lưu bản nháp vào tài khoản/);
  assert.equal(page.button('Lưu bản nháp').props.disabled, true);
});

test('restores a saved workspace and reopens unfinished edits with the current server status', async (t) => {
  const storedDraft = { version: 4, savedAt: '2026-09-26T10:00:00Z',
    form: { materialId: 'material', sourceFocus: 'Phân số', quantity: 2, questionType: 'SINGLE_CHOICE', difficulty: 'MEDIUM', includeExplanation: true },
    questions: [question('q1'), question('q2', 'APPROVED')], missingQuestionIds: [],
    edits: [{ questionId: 'q1', content: 'Nội dung lưu nháp', difficulty: 'MEDIUM', options: question('q1').options, correctOptionIds: ['a'], explanation: '' }] };
  let updated = false;
  const page = await render(t, { generate: false, storedDraft, strict: true, validateUpdate: (payload) => {
    assert.deepEqual(Object.keys(payload).sort(), ['content', 'correctOptionIds', 'difficulty', 'explanation', 'options']);
    assert.equal(payload.content, 'Nội dung lưu nháp'); updated = true;
  } });
  assert.match(page.text(), /Đã khôi phục bản nháp/);
  assert.ok(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung lưu nháp'));
  assert.equal(page.button('Duyệt tất cả').props.disabled, true);
  assert.equal(page.button('Lưu bản nháp').props.disabled, true);
  assert.deepEqual(page.calls, []);
  await act(async () => { page.renderer.root.findAllByType('button').find((node) => childText(node.props.children) === 'Lưu').props.onClick(); await flush(); });
  assert.equal(updated, true);
  assert.equal(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung lưu nháp'), false);
});

test('failed question updates retain the editor, and failed draft saves keep unsaved changes', async (t) => {
  const page = await render(t, { updateFailure: true, saveFailure: true });
  await act(async () => page.button('Sửa').props.onClick());
  await act(async () => { page.renderer.root.findAllByType('button').find((node) => childText(node.props.children) === 'Lưu').props.onClick(); await flush(); });
  assert.ok(page.renderer.root.findAllByType('textarea').some((node) => node.props.value === 'Nội dung q1'));
  await act(async () => { page.button('Lưu bản nháp').props.onClick(); await flush(); });
  assert.match(page.text(), /Không lưu được bản nháp/);
  assert.match(page.text(), /Có thay đổi chưa lưu/);
  assert.equal(page.button('Lưu bản nháp').props.disabled, false);
});
