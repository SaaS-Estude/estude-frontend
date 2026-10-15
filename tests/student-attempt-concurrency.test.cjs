/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const text = (value) => typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : '';
async function render(t, expired = false) {
  const calls = []; const callbacks = new Map(); let timer = 0;
  const savedGlobals = Object.fromEntries(['window', 'document', 'navigator'].map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
  Object.defineProperty(global, 'window', { configurable: true, value: {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout: (callback) => { callbacks.set(++timer, callback); return timer; }, clearTimeout: (id) => callbacks.delete(id),
    setInterval: () => 1, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  } });
  Object.defineProperty(global, 'document', { configurable: true, value: { addEventListener: () => {}, removeEventListener: () => {} } });
  Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: true } });
  let finishSave; let saves = 0; let submissions = 0;
  const pendingSave = new Promise((resolve) => { finishSave = resolve; });
  const attempt = { id: 'attempt', status: 'IN_PROGRESS', canResume: true, answers: [],
    startedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + (expired ? -1 : 60000)).toISOString(),
    exam: { title: 'Exam', settings: { durationMinutes: 2 }, questions: [{ questionId: 'q', order: 0, points: 1,
      question: { type: 'SINGLE_CHOICE', content: 'Question', options: [{ id: 'a', label: 'A', text: 'Answer' }] } }] } };
  const filename = path.resolve('components/assessment/student-exam-pages.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded); const Box = (props) => React.createElement('div', {}, props.children);
  const router = { push: (route) => calls.push(['route', route]), replace: () => {} };
  loaded.require = (id) => {
    if (id === '@/lib/study-analysis-loader') return loadTypeScript('lib/study-analysis-loader.ts', loaded.require);
    if (id === '@/lib/auth-api') return { ApiError: class ApiError extends Error {} };
    if (id === 'next/navigation') return { useParams: () => ({ id: 'attempt' }), useRouter: () => router };
    if (id === '@/lib/assessment-api') return { examAttemptService: {
      getAttempt: async () => attempt,
      saveAnswer: async () => { saves++; calls.push(['save']); await pendingSave; },
      submitExam: async () => { submissions++; calls.push(['submit']); if (expired && submissions === 1) throw new Error('Network conflict'); },
    } };
    if (id === '@/components/assessment/assessment-shell') return { AssessmentShell: Box, PageHeading: Box, LoadingPanel: Box, ErrorPanel: Box };
    if (id === '@/components/ui/button') return { Button: (props) => React.createElement('button', props) };
    if (id === '@/components/ui/form-control') return { Input: Box, Textarea: Box };
    if (id === '@/components/ui/modal') return { Modal: (props) => props.open ? React.createElement('div', { 'data-modal': true }, props.footer) : null };
    if (id === '@/components/assessment/question-image-viewer') return { QuestionImageViewer: Box };
    if (id === '@/types/assessment') return { QUESTION_TYPE_LABELS: {} };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  let ui;
  await act(async () => { ui = create(React.createElement(loaded.exports.StudentAttemptPage)); await new Promise(setImmediate); });
  t.after(async () => { finishSave(); await act(async () => ui.unmount()); for (const [key, descriptor] of Object.entries(savedGlobals)) {
    if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key];
  } });
  const button = (label) => ui.root.findAllByType('button').find((item) => text(item.props.children).trim() === label);
  return { ui, calls, callbacks, finishSave, button, counts: () => ({ saves, submissions }) };
}
test('manual submit drains an in-flight autosave and ignores double confirmation', async (t) => {
  const state = await render(t);
  await act(async () => state.ui.root.findByProps({ role: 'radio' }).props.onClick());
  await act(async () => { for (const callback of state.callbacks.values()) callback(); await new Promise(setImmediate); });
  assert.equal(state.counts().saves, 1);
  await act(async () => state.button('Nộp bài ngay').props.onClick());
  const confirm = state.ui.root.findByProps({ 'data-modal': true }).findAllByType('button').find((item) => text(item.props.children).trim() === 'Nộp bài');
  await act(async () => { confirm.props.onClick(); confirm.props.onClick(); await new Promise(setImmediate); });
  assert.equal(state.counts().submissions, 0);
  await act(async () => { state.finishSave(); await new Promise(setImmediate); });
  assert.equal(state.counts().submissions, 1);
  assert.deepEqual(state.calls.map((row) => row[0]), ['save', 'submit', 'route']);
});
test('after expiry a failed auto-submit still offers an enabled retry without reopening answers', async (t) => {
  const state = await render(t, true);
  assert.equal(state.counts().submissions, 1);
  assert.equal(state.ui.root.findByProps({ role: 'radio' }).props.disabled, true);
  assert.equal(state.button('Thử nộp lại').props.disabled, false);
  await act(async () => state.button('Thử nộp lại').props.onClick());
  assert.equal(state.counts().submissions, 2); assert.equal(state.counts().saves, 0);
});
