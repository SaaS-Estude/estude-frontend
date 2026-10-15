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
const fixture = (change) => ({ id: 'exam', classId: 'class', subjectId: 'subject', title: 'Exam',
  subjectName: 'History', className: 'Class', questions: [], totalPoints: 10, published: true,
  status: 'ONGOING', studentStatus: 'AVAILABLE', canStart: true, canResume: false, description: '',
  settings: { startsAt: '2026-10-03T08:00:00Z', endsAt: '2026-10-03T10:00:00Z', durationMinutes: 30, attemptsAllowed: 2 }, ...change });
async function render(t, exam, catalog = false) {
  const calls = [];
  const filename = path.resolve('components/assessment/student-exam-pages.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const Box = (props) => React.createElement('div', {}, props.children);
  loaded.require = (id) => {
    if (id === 'next/navigation') return { useParams: () => ({ id: 'exam' }), useRouter: () => ({ push: (route) => calls.push(['route', route]) }) };
    if (id === '@/lib/assessment-api') return { examService: { getExamById: async () => exam, getExams: async () => [exam] },
      examAttemptService: { startExam: async (id) => { calls.push(['start', id]); return { id: 'attempt' }; } } };
    if (id === '@/components/assessment/assessment-shell') return { AssessmentShell: Box, PageHeading: Box, LoadingPanel: Box, ErrorPanel: Box };
    if (id === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
    if (id === '@/components/ui/form-control') return { Input: Box, Textarea: Box };
    if (id === '@/components/ui/modal') return { Modal: () => null };
    if (id === '@/components/assessment/question-image-viewer') return { QuestionImageViewer: Box };
    if (id === '@/lib/study-analysis-loader') return { loadOrCreateStudentStudyAnalysis: async () => null };
    if (id === '@/types/assessment') return { QUESTION_TYPE_LABELS: {} };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  let ui;
  await act(async () => { ui = create(React.createElement(loaded.exports[catalog ? 'StudentExamCatalogPage' : 'StudentExamDetailPage']));
    await new Promise(setImmediate); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => ui.unmount()); });
  const buttons = () => ui.root.findAllByType('button');
  return { calls, buttons, ui };
}
test('AVAILABLE is not sufficient to show a start button when the server denies it', async (t) => {
  const { buttons, calls } = await render(t, fixture({ canStart: false, historyOnly: true }));
  assert.equal(buttons().some((button) => /Bắt đầu/.test(text(button.props.children))), false);
  assert.deepEqual(calls, []);
});
test('an owned continuation opens its exact attempt without issuing a new start request', async (t) => {
  const { buttons, calls } = await render(t, fixture({ canStart: false, historyOnly: true, canResume: true,
    studentStatus: 'IN_PROGRESS', currentAttempt: { id: 'old-attempt' } }));
  await act(async () => buttons().find((button) => text(button.props.children).includes('Tiếp tục làm bài')).props.onClick());
  assert.deepEqual(calls, [['route', '/student/attempts/old-attempt']]);
});
test('a locked/review-only attempt has no resume button', async (t) => {
  const { buttons } = await render(t, fixture({ canStart: false, canResume: false, historyOnly: true,
    studentStatus: 'IN_PROGRESS', currentAttempt: { id: 'old-attempt' } }));
  assert.equal(buttons().some((button) => /Tiếp tục|Bắt đầu/.test(text(button.props.children))), false);
});
test('catalog historical entries navigate to history without creating an attempt', async (t) => {
  const { buttons, calls } = await render(t, fixture({ canStart: false, historyOnly: true }), true);
  await act(async () => buttons().find((button) => text(button.props.children) === 'Xem lịch sử').props.onClick());
  assert.deepEqual(calls, [['route', '/student/exams/exam']]);
});
test('only an explicit canStart grant allows the start action', async (t) => {
  const { buttons, calls } = await render(t, fixture({}));
  await act(async () => buttons().find((button) => text(button.props.children).includes('Bắt đầu làm bài')).props.onClick());
  assert.deepEqual(calls, [['start', 'exam'], ['route', '/student/attempts/attempt']]);
});
