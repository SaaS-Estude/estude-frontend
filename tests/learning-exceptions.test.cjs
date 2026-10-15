/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
async function setup(t, mode = 'assignment', allowed = true, failSave = false) {
  const calls = [], filename = path.resolve('components/learning/learning-exception-form.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === '@/context/permissions-context') return { usePermissions: () => ({ can: () => allowed }) };
    if (id === '@/lib/assessment-api') return { academicDataService: { getTeacherAssignedClassRoster: async () => {
      calls.push(['roster']); return { students: [{ id: 'student', fullName: 'Học sinh', accountName: 'HS01' }] };
    } } };
    if (id === '@/lib/auth-api') return { authenticatedRequest: async (url, options) => {
      calls.push([url, options]);
      if (options) { if (failSave) throw new Error('Học kỳ đã khóa'); return {}; }
      const recipients = [{ studentId: 'student', revision: 3, learningOverride: mode === 'exam' ? {
        startsAt: '2026-10-04T01:00:00Z', endsAt: '2026-10-04T02:00:00Z', durationMinutes: 30, attemptsAllowed: 2,
      } : null }];
      return mode === 'exam' ? recipients : { assignment: { revision: 4, dueAt: '2026-10-04T01:00:00Z', cutoffAt: '2026-10-04T02:00:00Z' }, recipients };
    } };
    return original(id);
  };
  loaded._compile(compiled, filename);
  let renderer; await act(async () => { renderer = create(React.createElement(loaded.exports.LearningExceptionForm,
    { mode, sourceId: 'source', classId: 'class' })); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return { renderer, calls };
}
test('does not load roster until opened and does not load when permission is absent', async (t) => {
  const hidden = await setup(t, 'assignment', false); assert.equal(hidden.renderer.toJSON(), null); assert.equal(hidden.calls.length, 0);
  const { renderer, calls } = await setup(t); assert.equal(calls.length, 0);
  await act(async () => { renderer.root.findByType('button').props.onClick(); await flush(); });
  assert.equal(calls.length, 2);
});
for (const mode of ['assignment', 'exam']) test(`${mode}: sends explicit Vietnam instants and current revision for only selected student`, async (t) => {
  const { renderer, calls } = await setup(t, mode);
  await act(async () => { renderer.root.findByType('button').props.onClick(); await flush(); });
  await act(async () => { renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'student' } }); });
  await act(async () => { renderer.root.findByType('textarea').props.onChange({ target: { value: 'Medical extension' } }); });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  const [url, options] = calls.find((row) => row[1]); const payload = JSON.parse(options.body);
  assert.match(url, /student/); assert.equal(payload.revision, mode === 'exam' ? 3 : 4);
  assert.equal(payload[mode === 'exam' ? 'startsAt' : 'dueAt'], '2026-10-04T01:00:00.000Z');
  if (mode === 'exam') assert.equal(payload.attemptsAllowed, 2);
  assert.match(JSON.stringify(renderer.toJSON()), /Đã cấp lịch riêng/);
});
test('shows server rejection without claiming success and leaves form editable', async (t) => {
  const { renderer } = await setup(t, 'assignment', true, true);
  await act(async () => { renderer.root.findByType('button').props.onClick(); await flush(); });
  await act(async () => { renderer.root.findByType('select').props.onChange({ target: { value: 'student' } }); });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await flush(); });
  assert.match(JSON.stringify(renderer.toJSON()), /Học kỳ đã khóa/); assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Đã cấp lịch riêng/);
  assert.equal(renderer.root.findAllByType('button').find((row) => row.props.type === 'submit').props.disabled, false);
});
