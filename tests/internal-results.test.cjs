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
function compile(filename, overrides = {}) {
  const file = path.resolve(filename), loaded = new Module(file, module);
  loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => overrides[id] ?? original(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, file);
  return loaded.exports;
}
const helpers = compile('lib/internal-results.ts');
const group = { purpose: 'REGULAR', average: 7, scoredCount: 1, publishedCount: 1, passCount: 0, failCount: 0 };
function fixture(title = 'Bài của con thứ nhất') {
  return { years: [{ id: 'year', name: '2026-2027', status: 'ACTIVE' }],
    terms: [{ id: 'term', academicYearId: 'year', name: 'HK1', displayOrder: 1, status: 'ACTIVE' }],
    classes: [{ id: 'class', academicYearId: 'year', code: '10A1' }], subjects: [{ id: 'math', name: 'Toán' }],
    rows: [{ classId: 'class', academicYearId: 'year', termId: 'term', subjectId: 'math', subjectName: 'Toán', assignedCount: 2, completedCount: 1, completionPercentage: 50, excusedCount: 0, groups: [group] }],
    items: [{ id: 'item', classId: 'class', subjectId: 'math', termId: 'term', title, assessmentPurpose: 'REGULAR', score: 7, maxScore: 10, normalizedScore: 7, evaluationStatus: 'GRADED', publicationStatus: 'PUBLISHED', completed: true, feedback: 'Đã công bố', publishedAt: '2026-10-01', archived: false }],
    pagination: { page: 1, pageSize: 20, total: 1 }, unclassifiedCount: 0 };
}
function loadReport(internalReport) {
  return compile('components/assessment/internal-grade-report.tsx', {
    '@/lib/gradebook-api': { gradebookService: { internalReport } },
    '@/lib/internal-results': helpers,
    './official-grade-report': { OfficialGradeReport: () => null },
  }).InternalGradeReport;
}
test('renders zero separately from unpublished/missing grades', () => {
  const item = fixture().items[0];
  assert.equal(helpers.internalResultText({ ...item, score: 0 }), '0/10');
  assert.equal(helpers.internalResultText({ ...item, score: null, publishedAt: null }), 'Chưa công bố điểm');
  assert.equal(helpers.internalResultText({ ...item, score: null, evaluationStatus: 'MISSING' }), 'Chưa nộp');
  assert.equal(helpers.internalResultText({ ...item, excused: true }), 'Được miễn');
});
test('shows the published average, coverage and filters instead of official weighted grades', async (t) => {
  const calls = [];
  const Report = loadReport(async (id, query) => { calls.push({ id, query }); return fixture(); });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Report, { studentId: 'first' })); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const text = JSON.stringify(renderer.toJSON());
  assert.match(text, /7\.0\/10/); assert.match(text, /Bài của con thứ nhất/); assert.doesNotMatch(text, /Thông tư|Xếp loại/);
  assert.equal(calls.at(-1).query.termId, 'term'); assert.equal(calls.at(-1).query.classId, 'class');
  await act(async () => { renderer.root.findByProps({ 'aria-label': 'Môn học kết quả' }).props.onChange({ target: { value: 'math' } }); await new Promise(setImmediate); });
  assert.equal(calls.at(-1).query.subjectId, 'math'); assert.equal(calls.at(-1).query.page, 1);
});
test('does not display the previous child or accept their late response after switching', async (t) => {
  let resolveLate;
  const Report = loadReport((id, query) => {
    if (id === 'first' && query.academicYearId) return new Promise((resolve) => { resolveLate = resolve; });
    return Promise.resolve(fixture(id === 'first' ? 'Bài của con thứ nhất' : 'Bài của con thứ hai'));
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Report, { studentId: 'first' })); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  await act(async () => { renderer.update(React.createElement(Report, { studentId: 'second' })); await new Promise(setImmediate); });
  assert.match(JSON.stringify(renderer.toJSON()), /Bài của con thứ hai/);
  await act(async () => { resolveLate(fixture('KẾT QUẢ CŨ KHÔNG ĐƯỢC HIỆN')); await new Promise(setImmediate); });
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /KẾT QUẢ CŨ|Bài của con thứ nhất/);
});
test('removes results when access is denied', async (t) => {
  const Report = loadReport(async () => { throw new Error('Liên kết đã thu hồi'); });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Report, { studentId: 'first' })); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.match(JSON.stringify(renderer.toJSON()), /Liên kết đã thu hồi/);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Bài của con thứ nhất/);
});
