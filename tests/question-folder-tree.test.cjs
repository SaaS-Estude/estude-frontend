/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const filename = path.resolve('components/assessment/question-folder-tree.tsx');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const original = loaded.require.bind(loaded);
loaded.require = (id) => id === 'lucide-react'
  ? new Proxy({}, { get: () => () => React.createElement('svg') })
  : original(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const { QuestionFolderTree, folderDescendantIds } = loaded.exports;

const folders = [
  { id: 'a', parentId: null, name: 'Lớp 12', depth: 1 },
  { id: 'b', parentId: 'a', name: 'Sinh học', depth: 2 },
  { id: 'c', parentId: 'b', name: 'Di truyền', depth: 3 },
];

test('selects a parent with all descendants and stops offering subfolders at level three', async () => {
  assert.deepEqual([...folderDescendantIds(folders, 'a')], ['a', 'b', 'c']);
  const created = [];
  const selected = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(QuestionFolderTree, {
      folders, selected: 'all', counts: { all: 4, unfiled: 1, a: 1, b: 1, c: 1 },
      canCreate: true, canUpdate: true, canDelete: true,
      onSelect: (id) => selected.push(id), onCreate: (id) => created.push(id),
      onRename: () => {}, onDelete: () => {},
    }));
  });
  const buttons = () => renderer.root.findAllByType('button');
  assert.equal(buttons().filter((button) => button.props.title === 'Tạo thư mục con').length, 2);
  await act(async () => buttons().find((button) => button.props.title === 'Tạo thư mục con').props.onClick());
  assert.deepEqual(created, ['a']);
  await act(async () => buttons().find((button) => button.props.title === 'Di truyền').props.onClick());
  assert.deepEqual(selected, ['c']);
  await act(async () => renderer.unmount());
});
