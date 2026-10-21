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
const childText = (value) => typeof value === 'string' ? value : Array.isArray(value)
  ? value.map(childText).join('') : value?.props ? childText(value.props.children) : '';

async function render(t, released, fail = false) {
  const state = { loads: 0, retries: 0, gets: 0, attempt: {
    id: 'attempt', status: 'SUBMITTED', answersReleased: released,
    answerReleaseMessage: released ? '' : 'Đáp án chỉ mở sau khi bài thi kết thúc.',
    score: 2, correctCount: 0, answers: [], durationSeconds: 21,
    exam: { title: 'Kiểm tra', totalPoints: 10, settings: { showScoreImmediately: true },
      questions: [{ questionId: 'q', question: { type: 'SINGLE_CHOICE' } }] },
  } };
  const analysis = { report: { performance: { needsWarning: true },
    learningPath: { steps: [], totalDurationMinutes: 0 } } };
  const filename = path.resolve('components/assessment/student-exam-pages.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  const router = { push() {}, replace() {} };
  const Box = (props) => React.createElement('div', {}, props.children);
  loaded.require = (id) => {
    if (id === '@/lib/features') return { FEATURES: { examAnalysis: true } };
    if (id === 'next/navigation') return { useParams: () => ({ id: 'attempt' }), useRouter: () => router };
    if (id === 'lucide-react') return new Proxy({}, { get: () => () => React.createElement('svg') });
    if (id === '@/components/assessment/assessment-shell') return { AssessmentShell: Box, PageHeading: Box, ErrorPanel: Box, LoadingPanel: Box };
    if (id === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
    if (id === '@/lib/assessment-api') return { examAttemptService: {
      getAttempt: async () => { state.gets++; return state.attempt; },
      retryStudyAnalysis: async () => { state.retries++; return analysis; },
    } };
    if (id === '@/lib/study-analysis-loader') return { loadOrCreateStudentStudyAnalysis: async () => {
      state.loads++;
      if (fail) throw new Error('AI unavailable');
      return analysis;
    } };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  let ui;
  await act(async () => { ui = create(React.createElement(loaded.exports.StudentResultPage)); await flush(); });
  t.after(async () => { await act(async () => ui.unmount()); });
  return { state, text: () => JSON.stringify(ui.toJSON()), click: async (label) => {
    const button = ui.root.findAllByType('button').find((b) => childText(b.props.children) === label);
    assert.ok(button, label);
    await act(async () => { await button.props.onClick(); await flush(); });
  } };
}

test('visible score with locked answers explains the gate without calling AI', async (t) => {
  const page = await render(t, false);
  assert.match(page.text(), /Chờ mở đáp án/);
  assert.match(page.text(), /Đáp án chỉ mở sau khi bài thi kết thúc/);
  assert.doesNotMatch(page.text(), /AI đã ưu tiên/);
  assert.equal(page.state.loads, 0);
  await page.click('Kiểm tra lại quyền phân tích');
  assert.equal(page.state.gets, 2);
  assert.equal(page.state.loads, 0);
  assert.equal(page.state.retries, 0);
});

test('refreshing after answers open loads or creates analysis without forcing regeneration', async (t) => {
  const page = await render(t, false);
  page.state.attempt = { ...page.state.attempt, answersReleased: true, answerReleaseMessage: '' };
  await page.click('Kiểm tra lại quyền phân tích');
  assert.equal(page.state.loads, 1);
  assert.equal(page.state.retries, 0);
  assert.match(page.text(), /Đã tạo phân tích và lộ trình học/);
});

test('immediately released answers trigger analysis and failures do not claim a completed plan', async (t) => {
  const page = await render(t, true, true);
  assert.equal(page.state.loads, 1);
  assert.match(page.text(), /AI unavailable/);
  assert.doesNotMatch(page.text(), /AI đã ưu tiên/);
  await page.click('Thử phân tích lại');
  assert.equal(page.state.retries, 1);
});
