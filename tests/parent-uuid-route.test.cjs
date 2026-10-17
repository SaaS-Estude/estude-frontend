const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve('app/parent/dashboard/[studentId]/page.tsx');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const original = loaded.require.bind(loaded);
loaded.require = id => {
  if (id === 'next/navigation') return {notFound() { throw new Error('NOT_FOUND'); }};
  if (id === '@/components/auth/role-gate') return {RoleGate: 'role-gate'};
  if (id === '@/components/parent/parent-dashboard') return {ParentDashboard: 'parent-dashboard'};
  return original(id);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText, filename);
test('parent child route accepts PostgreSQL UUID and preserves selected child', async () => {
  const id = 'da4bc02b-d0d0-46da-a20a-1df10e7513bd';
  const page = await loaded.exports.default({params: Promise.resolve({studentId: id})});
  assert.equal(page.props.allowedRole, 'PARENT');
  assert.equal(page.props.children.props.studentId, id);
});
test('parent child route rejects obsolete ObjectId and malformed identifiers', async () => {
  for (const studentId of ['507f1f77bcf86cd799439011', 'undefined', '../student', 'no-uuid']) {
    await assert.rejects(loaded.exports.default({params: Promise.resolve({studentId})}), /NOT_FOUND/);
  }
});
