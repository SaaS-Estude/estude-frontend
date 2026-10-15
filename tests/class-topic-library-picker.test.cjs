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

test("assigns selected library materials to the current class topic without selecting attached files", async () => {
  const calls = [];
  const notifications = [];
  const filename = path.resolve("components/teacher/class-topic-library-picker.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/link") return { default: (props) => React.createElement("a", props) };
    if (id === "@/components/ui/button") return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/modal") return {
      Modal: ({ children, footer }) => React.createElement("div", null, children, footer),
    };
    if (id === "@/components/ui/action-notification") return {
      useActionNotification: () => ({ notify: (message) => notifications.push(message) }),
    };
    if (id === "@/lib/search-keyword") return {
      matchesSearchKeyword: (value, search) => value.toLowerCase().includes(search.toLowerCase()),
    };
    if (id === "@/lib/assessment-api") return {
      academicDataService: {
        getMaterialLibrary: async () => [
          { id: "already", originalName: "Đã gán.pdf", size: 1024 },
          { id: "new", originalName: "Lịch sử.pdf", size: 2048 },
        ],
        bulkAssignMaterials: async (materialIds, targets) => {
          calls.push({ materialIds, targets });
          return { assignedCount: 1 };
        },
      },
    };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const topic = {
    id: "topic", classId: "class", subjectId: "subject", name: "Chương I",
    subject: { code: "LS" }, materials: [{ id: "already" }],
  };
  let assigned = 0;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(loaded.exports.ClassTopicLibraryPicker, {
      topic, onClose: () => {}, onAssigned: async () => { assigned += 1; },
    }));
    await new Promise(setImmediate);
  });
  const checkboxes = renderer.root.findAllByType("input").filter((node) => node.props.type === "checkbox");
  assert.equal(checkboxes.length, 2);
  assert.equal(checkboxes[0].props.disabled, true);
  assert.equal(checkboxes[0].props.checked, true);
  await act(async () => checkboxes[1].props.onChange());
  const assign = renderer.root.findAllByType("button")
    .find((button) => button.props.permission === "materials.assign");
  await act(async () => assign.props.onClick());
  assert.deepEqual(calls, [{ materialIds: ["new"], targets: [{
    classId: "class", subjectId: "subject", topicId: "topic",
  }] }]);
  assert.equal(assigned, 1);
  assert.match(notifications[0], /Đã gán 1 tài liệu/);
  await act(async () => renderer.unmount());
});
