/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");

global.IS_REACT_ACT_ENVIRONMENT = true;
global.sessionStorage = (() => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
})();

const textOf = (node) =>
  typeof node === "string" || typeof node === "number" ? String(node)
    : Array.isArray(node) ? node.map(textOf).join("")
      : textOf(node?.children ?? []);

function load() {
  const filename = path.resolve("components/student/study-review-reminder-popup.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/components/ui/button") return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/modal") return { Modal: ({ open, title, children, footer }) => open ? React.createElement("section", null, title, children, footer) : null };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

test("shows an unread study reminder and opens its review action", async (t) => {
  const { StudyReviewReminderPopup } = load();
  const reminder = { id: "reminder", title: "Nhắc ôn tập: Lịch sử", message: "Hãy ôn lại bài học.", readAt: null };
  const started = [];
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(StudyReviewReminderPopup, {
      notifications: [reminder],
      onStartReview: async (item) => { started.push(item.id); },
    }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.match(textOf(renderer.toJSON()), /Nhắc ôn tập: Lịch sử/);
  const buttons = renderer.root.findAllByType("button");
  const button = buttons.at(-1);
  assert.ok(button);
  await act(async () => { button.props.onClick(); await new Promise(setImmediate); });
  assert.deepEqual(started, ["reminder"]);
});
