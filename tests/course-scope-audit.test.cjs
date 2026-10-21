require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
const text = (value) => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : '';

function load(filename, mocks) {
  const file = path.resolve(filename), loaded = new Module(file, module);
  loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => mocks[id] ?? original(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, file);
  return loaded.exports;
}

const box = ({ children }) => React.createElement('div', null, children);
const shell = { AssessmentShell: box, PageHeading: () => null, ErrorPanel: ({ message }) => React.createElement('p', null, message) };
const schoolClass = { id: 'class', code: '12A2', name: '12A2', subjects: [{ id: 'history', name: 'Lịch sử' }] };
const picker = { CourseWorkspacePicker: ({ onResolved }) => {
  React.useEffect(() => onResolved(true), [onResolved]);
  return React.createElement('p', null, 'Chọn lớp môn học');
} };

test('notifications require a course choice and lock class/subject to the selected workspace', async (t) => {
  let selected = '';
  const calls = [];
  const { TeacherEngagementCenter } = load('components/teacher/engagement-center.tsx', {
    './course-workspace-picker': picker,
    '@/lib/course-workspace': { currentCourseId: () => selected },
    '@/components/assessment/assessment-shell': shell,
    '@/components/ui/button': { Button: (props) => React.createElement('button', props) },
    '@/components/ui/action-notification': { useActionNotification: () => ({ notify() {} }) },
    '@/components/ui/modal': { Modal: ({ open, children, footer }) => open ? React.createElement('aside', null, children, footer) : null },
    '@/lib/assessment-api': { academicDataService: { getTeacherAssignedClasses: async () => [schoolClass] } },
    '@/lib/engagement-api': { notificationService: { sendClass: async (payload) => { calls.push(payload); return { recipientCount: 1 }; } } },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(TeacherEngagementCenter, { mode: 'message' })); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const button = (label) => renderer.root.findAllByType('button').find((node) => text(node.props.children).includes(label));
  await act(async () => button('Gửi thông báo').props.onClick());
  assert.match(JSON.stringify(renderer.toJSON()), /Vui lòng chọn môn học theo lớp và học kỳ/);
  assert.equal(calls.length, 0);
  selected = 'course-two';
  await act(async () => { renderer.update(React.createElement(TeacherEngagementCenter, { key: selected, mode: 'message' })); await flush(); });
  for (const label of ['Chọn lớp học', 'Chọn môn học']) {
    assert.ok(renderer.root.findAll((node) => node.props.ariaLabel === label).every((node) => node.props.disabled));
  }
  await act(async () => {
    renderer.root.findAllByType('input').find((node) => node.props.maxLength === 160).props.onChange({ target: { value: 'Nhắc lịch' } });
    renderer.root.findByType('textarea').props.onChange({ target: { value: 'Nội dung fixture' } });
  });
  await act(async () => button('Gửi thông báo').props.onClick());
  await act(async () => { button('Xác nhận gửi').props.onClick(); await flush(); });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].classId, 'class');
  assert.equal(calls[0].subjectId, 'history');
});

test('attendance waits for an explicit workspace rather than querying an ambiguous class/subject', async (t) => {
  const calls = [];
  const { TeacherAttendancePanel } = load('components/teacher/teacher-attendance-panel.tsx', {
    './course-workspace-picker': picker,
    '@/lib/course-workspace': { currentCourseId: () => '' },
    '@/components/assessment/assessment-shell': shell,
    '@/components/ui/button': { Button: (props) => React.createElement('button', props) },
    '@/lib/assessment-api': { academicDataService: { getTeacherAssignedClasses: async () => [schoolClass] } },
    '@/lib/engagement-api': { attendanceService: { listSessions: async () => { calls.push('list'); return []; } } },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(TeacherAttendancePanel)); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.deepEqual(calls, []);
  assert.match(JSON.stringify(renderer.toJSON()), /Chọn môn học theo lớp và học kỳ ở trên/);
  const createButton = renderer.root.findAllByType('button').find((node) => node.props.children === 'Tạo lần điểm danh');
  assert.equal(createButton.props.disabled, true);
});

test('the workspace picker distinguishes parallel groups with the same course title', async (t) => {
  const readiness = [];
  const { CourseWorkspacePicker } = load('components/teacher/course-workspace-picker.tsx', {
    '@/lib/course-workspace': { currentCourseId: () => '' },
    '@/lib/course-offering-api': { courseOfferingApi: { list: async () => [
      { id: 'a', primaryClassId: 'class', displayName: 'Lịch sử - 12A2 - Học kỳ 1', sectionKey: 'A' },
      { id: 'b', primaryClassId: 'class', displayName: 'Lịch sử - 12A2 - Học kỳ 1', sectionKey: 'B' },
    ] } },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(CourseWorkspacePicker, { onResolved: (hasCourses) => readiness.push(hasCourses) })); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.deepEqual(readiness, [true]);
  const labels = renderer.root.findAllByType('option').map((node) => text(node.props.children));
  assert.ok(labels.some((label) => label.includes('Nhóm A')));
  assert.ok(labels.some((label) => label.includes('Nhóm B')));
});
