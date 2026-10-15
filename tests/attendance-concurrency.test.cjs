/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const text = (value) => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : '';
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
const version = { expectedUpdatedAt: '2026-10-03T09:00:00.000Z', expectedReopenedCount: 0 };
async function render(t, conflict = false) {
  const calls = [];
  const session = { id: 'session', status: 'OPEN', updatedAt: version.expectedUpdatedAt, reopenedCount: 0 };
  const filename = path.resolve('components/teacher/teacher-attendance-panel.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const Box = (props) => React.createElement('div', {}, props.children);
  loaded.require = (id) => {
    if (id === '@/lib/assessment-api') return { academicDataService: { getTeacherAssignedClasses: async () => [{ id: 'class', code: '12A', name: 'Class', subjects: [{ id: 'subject', name: 'History' }] }] } };
    if (id === '@/lib/auth-api') return { ApiError };
    if (id === '@/lib/engagement-api') return { attendanceService: {
      listSessions: async () => [session], getAudit: async () => [],
      getSession: async () => { calls.push(['detail']); return { session, students: [{ id: 'student', fullName: 'Student', accountName: 's', status: 'PRESENT', attendance: { note: '' } }] }; },
      saveSession: async (...args) => { calls.push(['save', ...args]); if (conflict) throw new ApiError('Tab khác đã sửa', 409); return { updatedAt: '2026-10-03T09:00:00.001Z', reopenedCount: 0 }; },
      finalizeSession: async (...args) => { calls.push(['finalize', ...args]); },
    } };
    if (id === '@/components/assessment/assessment-shell') return { AssessmentShell: Box, PageHeading: Box };
    if (id === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
    if (id === '@/lib/subject-localization') return { getVietnameseSubjectName: (subject) => subject.name };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  let ui;
  await act(async () => { ui = create(React.createElement(loaded.exports.TeacherAttendancePanel)); await new Promise(setImmediate); });
  const button = (label) => ui.root.findAllByType('button').find((item) => text(item.props.children) === label);
  await act(async () => button('Lần mặc định · OPEN').props.onClick());
  t.after(async () => { await act(async () => ui.unmount()); });
  const change = async () => act(async () => ui.root.findAllByType('select').find((item) => item.props['aria-label'] === 'Trạng thái Student').props.onChange({ target: { value: 'ABSENT' } }));
  return { ui, calls, button, change };
}
test('save sends the version loaded by this tab, not a silently refreshed version', async (t) => {
  const { calls, button, change } = await render(t);
  await change(); await act(async () => button('Lưu').props.onClick());
  assert.deepEqual(calls.find((row) => row[0] === 'save'), ['save', 'session', [{ studentId: 'student', status: 'ABSENT', note: '' }], version, '']);
});
test('finalize includes dirty marks and uses the version returned by that save', async (t) => {
  const { calls, button, change } = await render(t);
  await change(); await act(async () => button('Chốt buổi').props.onClick());
  assert.deepEqual(calls.filter((row) => ['save', 'finalize'].includes(row[0])).map((row) => row[0]), ['save', 'finalize']);
  assert.deepEqual(calls.find((row) => row[0] === 'finalize'), ['finalize', 'session', { expectedUpdatedAt: '2026-10-03T09:00:00.001Z', expectedReopenedCount: 0 }]);
});
test('clean finalize still checks the displayed version without an unnecessary save', async (t) => {
  const { calls, button } = await render(t);
  await act(async () => button('Chốt buổi').props.onClick());
  assert.equal(calls.some((row) => row[0] === 'save'), false);
  assert.deepEqual(calls.find((row) => row[0] === 'finalize'), ['finalize', 'session', version]);
});
test('conflict preserves unsaved marks and does not retry or finalize until explicit reload', async (t) => {
  const { calls, button, change, ui } = await render(t, true);
  await change(); await act(async () => button('Chốt buổi').props.onClick());
  assert.equal(calls.filter((row) => row[0] === 'save').length, 1);
  assert.equal(calls.some((row) => row[0] === 'finalize'), false);
  assert.equal(calls.filter((row) => row[0] === 'detail').length, 1);
  const select = ui.root.findAllByType('select').find((item) => item.props['aria-label'] === 'Trạng thái Student');
  assert.equal(select.props.value, 'ABSENT'); assert.equal(select.props.disabled, true);
  await act(async () => button('Tải lại dữ liệu (bỏ chỉnh sửa chưa lưu)').props.onClick());
  assert.equal(calls.filter((row) => row[0] === 'detail').length, 2);
  assert.equal(ui.root.findAllByType('select').find((item) => item.props['aria-label'] === 'Trạng thái Student').props.value, 'PRESENT');
});
