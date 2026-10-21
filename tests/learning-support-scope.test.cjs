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

function load(filename, mocks) {
  const file = path.resolve(filename);
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => mocks[id] ?? original(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, file);
  return loaded.exports;
}

function overview() {
  const base = {
    classId: 'class', classCode: '12A2', className: 'Lớp 12A2', subjectId: 'history',
    subjectCode: 'HIST', subjectName: 'Lịch sử', studentCount: 1, error: null, examCount: 1,
    riskSummary: null, materialContext: null,
    levelCounts: { HIGH: 0, WATCH: 0, STABLE: 0, INSUFFICIENT: 1 },
  };
  return {
    generatedAt: '2026-10-21T10:00:00Z',
    scopes: [
      { ...base, courseOfferingId: 'course-one', term: { id: 'term-one', name: 'Học kỳ 1' }, sectionKey: 'A', anchorExamId: 'exam-one' },
      { ...base, courseOfferingId: 'course-two', term: { id: 'term-two', name: 'Học kỳ 2' }, sectionKey: 'B', anchorExamId: 'exam-two' },
    ],
    totals: { classCount: 1, scopeCount: 2, atRiskStudentCount: 0, evaluatedStudentCount: 0 },
  };
}

const sharedMocks = {
  'next/link': { default: (props) => React.createElement('a', props) },
  '@/components/assessment/assessment-shell': { AssessmentShell: (props) => React.createElement('main', props) },
};

test('overview keeps both term/group links and searches their labels', async (t) => {
  const { LearningSupportOverviewPage } = load('components/assessment/learning-support-overview-page.tsx', {
    ...sharedMocks,
    '@/context/permissions-context': { usePermissions: () => ({ can: () => true, loading: false }) },
    '@/lib/assessment-api': { examService: { getLearningSupportOverview: async () => overview() } },
    '@/components/ui/date-range-picker': { DateRangePicker: () => null },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(LearningSupportOverviewPage)); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const links = () => renderer.root.findAllByType('a').filter((node) => node.props.href.includes('/teacher/learning-support/'));
  assert.deepEqual(links().map((node) => node.props.href), [
    '/teacher/learning-support/class/history?courseOfferingId=course-one',
    '/teacher/learning-support/class/history?courseOfferingId=course-two',
  ]);
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Học kỳ 2' } }));
  assert.equal(links().length, 1);
  assert.match(links()[0].props.href, /course-two/);
});

test('detail resolves the requested course and refuses an ambiguous old class/subject link', async (t) => {
  let courseId = 'course-two';
  const calls = [];
  const { LearningSupportScopePage } = load('components/assessment/learning-support-scope-page.tsx', {
    ...sharedMocks,
    'next/navigation': {
      useParams: () => ({ classId: 'class', subjectId: 'history' }),
      useSearchParams: () => ({ get: () => courseId }),
    },
    '@/lib/assessment-api': { examService: {
      getLearningSupportOverview: async () => overview(),
      getSubjectSupport: async (id) => { calls.push(id); return { courseOfferingId: courseId }; },
    } },
    '@/components/assessment/subject-support-page': { SubjectSupportDetail: ({ examId }) => React.createElement('article', null, examId) },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(LearningSupportScopePage)); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.deepEqual(calls, ['exam-two']);
  assert.match(JSON.stringify(renderer.toJSON()), /exam-two/);
  courseId = null;
  await act(async () => { renderer.update(React.createElement(LearningSupportScopePage)); await flush(); });
  assert.deepEqual(calls, ['exam-two']);
  assert.match(JSON.stringify(renderer.toJSON()), /nhiều học kỳ hoặc nhóm/);
  courseId = 'unassigned-course';
  await act(async () => { renderer.update(React.createElement(LearningSupportScopePage)); await flush(); });
  assert.deepEqual(calls, ['exam-two']);
  assert.match(JSON.stringify(renderer.toJSON()), /Không tìm thấy lớp\/môn/);
});
