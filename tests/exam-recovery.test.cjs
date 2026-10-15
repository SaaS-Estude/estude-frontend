/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react'), { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
async function setup(t, { permissions = ['exams.create', 'exams.submissions', 'exams.publish'], fail = false, state = 'ENDED' } = {}) {
  const calls = [], filename = path.resolve('components/assessment/exam-recovery-panel.tsx');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === '@/context/permissions-context') return { usePermissions: () => ({ can: (key) => permissions.includes(key) }) };
    if (id === '@/lib/assessment-api') return { academicDataService: { getTeacherAssignedClassRoster: async () => {
      calls.push(['roster']); return { students: [{ id: 'student', fullName: 'Học sinh', accountName: 'HS01' }] };
    } }, examService: { resolveQuestion: async (id, payload) => {
      calls.push(['resolve', id, payload]); if (fail) throw new Error('Học kỳ đã khóa'); return { regradedAttempts: 3, changedGrades: 2 };
    }, publishExamResults: async (id) => { calls.push(['publish', id]); return {}; } } };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  const exam = { id: 'exam', classId: 'class', published: true, status: state, updatedAt: '2026-10-03T01:00:00Z',
    questions: [{ questionId: 'q1', type: 'SINGLE_CHOICE', content: 'Câu hỏi', options: [{ id: 'a', label: 'A', text: 'Đáp án' }] }] };
  let renderer; await act(async () => { renderer = create(React.createElement(loaded.exports.ExamRecoveryPanel, { exam,
    onMakeup: (ids, reason) => calls.push(['makeup', ids, reason]), onChanged: async () => calls.push(['reload']) })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (text) => renderer.root.findAllByType('button').find((b) => JSON.stringify(b.children).includes(text));
  return { renderer, calls, button, text: () => JSON.stringify(renderer.toJSON()) };
}
test('recovery is hidden before exam end or without permission', async (t) => {
  for (const config of [{ permissions: [] }, { state: 'ONGOING' }]) {
    const { renderer, calls } = await setup(t, config); assert.equal(renderer.toJSON(), null); assert.equal(calls.length, 0);
  }
});
test('roster loads lazily and only selected students reach the separate-paper wizard', async (t) => {
  const { renderer, calls, button } = await setup(t); assert.equal(calls.length, 0);
  await act(async () => { button('Tạo đề thi bù riêng').props.onClick(); await flush(); });
  await act(async () => { renderer.root.findByType('input').props.onChange({ target: { checked: true } });
    renderer.root.findByType('textarea').props.onChange({ target: { value: '  Nghỉ ốm có xác nhận  ' } }); });
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(calls, [['roster'], ['makeup', ['student'], 'Nghỉ ốm có xác nhận']]);
});
for (const mode of ['FULL_CREDIT', 'EXCLUDE', 'CORRECT_KEY']) test(`question resolution sends ${mode}, source version and reason; requires explicit result return`, async (t) => {
  const { renderer, calls, button, text } = await setup(t);
  await act(async () => button('Xử lý câu hỏi lỗi').props.onClick());
  await act(async () => renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'q1' } }));
  await act(async () => { renderer.root.findAllByType('select')[1].props.onChange({ target: { value: mode } });
    renderer.root.findByType('textarea').props.onChange({ target: { value: 'Câu hỏi lỗi' } }); });
  if (mode === 'CORRECT_KEY') await act(async () => renderer.root.findByType('input').props.onChange({ target: { checked: true } }));
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  const payload = calls.find((c) => c[0] === 'resolve')[2];
  assert.deepEqual(payload, { questionId: 'q1', mode, expectedUpdatedAt: '2026-10-03T01:00:00Z', reason: 'Câu hỏi lỗi',
    ...mode === 'CORRECT_KEY' ? { correctOptionIds: ['a'] } : {} });
  assert.match(text(), /Điểm đã trả chưa đổi/); assert(!calls.some((c) => c[0] === 'publish'));
  await act(async () => { button('Trả điểm sau khi chấm lại').props.onClick(); await flush(); });
  assert(calls.some((c) => c[0] === 'publish')); assert.match(text(), /Đã trả điểm mới/);
});
test('409 rejection is visible without success or result-return action', async (t) => {
  const { renderer, button, text } = await setup(t, { fail: true });
  await act(async () => button('Xử lý câu hỏi lỗi').props.onClick());
  await act(async () => renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'q1' } }));
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.match(text(), /Học kỳ đã khóa/); assert.doesNotMatch(text(), /Đã chấm lại/); assert(!button('Trả điểm sau khi chấm lại'));
});
