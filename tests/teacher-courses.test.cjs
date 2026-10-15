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

function loadSelection() {
  const filename = path.resolve("lib/teacher-course-selection.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports.selectedTeacherSubjectId;
}

function loadPanel(classes) {
  const filename = path.resolve("components/teacher/assigned-courses-panel.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/link") return { __esModule: true, default: ({ href, children, ...props }) =>
      React.createElement("a", { href, ...props }, children) };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/lib/assessment-api") return { academicDataService: {
      getTeacherAssignedClasses: async () => classes,
    } };
    if (id === "@/lib/subject-localization") return {
      getVietnameseSubjectName: (subject) => subject.vietnameseName || subject.name,
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports.TeacherAssignedCoursesPanel;
}

test("teacher courses come from current assignments and link to the exact class and subject", async (t) => {
  const Panel = loadPanel([
    { id: "class-a", code: "10A", name: "Lớp 10A", studentCount: 30,
      subjects: [{ id: "math", code: "MATH", name: "Math", vietnameseName: "Toán" },
        { id: "physics", code: "PHY", name: "Physics", vietnameseName: "Vật lý" }] },
    { id: "homeroom-only", code: "10B", name: "Lớp 10B", studentCount: 25, subjects: [] },
  ]);
  let renderer;
  await act(async () => { renderer = create(React.createElement(Panel)); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const links = renderer.root.findAllByType("a").map((link) => link.props.href);
  assert.deepEqual(links, [
    "/teacher/classes/class-a?subjectId=math",
    "/teacher/classes/class-a?subjectId=physics",
  ]);
  assert.match(JSON.stringify(renderer.toJSON()), /Toán/);
  assert.match(JSON.stringify(renderer.toJSON()), /Vật lý/);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Lớp 10B/);
});

test("teacher with no subject assignment sees an honest empty state", async (t) => {
  const Panel = loadPanel([]);
  let renderer;
  await act(async () => { renderer = create(React.createElement(Panel)); await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.equal(renderer.root.findAllByType("a").length, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /chưa được phân công môn học/);
});

test("course deep link selects only an assigned subject", () => {
  const select = loadSelection();
  const subjects = [{ id: "math" }, { id: "physics" }];
  assert.equal(select(subjects, "?subjectId=physics"), "physics");
  assert.equal(select(subjects, "?subjectId=other-class-subject"), "math");
  assert.equal(select([], "?subjectId=physics"), "");
});
