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
const visibleText = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(visibleText).join("");
  return value?.children ? visibleText(value.children) : "";
};

const plan = {
  id: "plan",
  title: "Ôn tập Chủ đề chương I",
  summary: "Tập trung củng cố kiến thức còn thiếu.",
  successCriteria: "Đạt ít nhất 70% ở bài luyện.",
  objectiveId: "objective",
  objective: { title: "Chủ đề chương I", granularity: "TOPIC" },
  status: "ASSIGNED",
  dueAt: null,
  targetAccuracyPercent: 70,
  tasks: [
    {
      id: "material",
      order: 1,
      kind: "MATERIAL",
      title: "Đọc và ôn Chủ đề chương I",
      description: "Đọc tài liệu đã gắn.",
      status: "ASSIGNED",
      actionUrl: "/student/material",
      overdue: false,
      progress: { status: "NOT_STARTED", difficultyNote: null },
    },
    {
      id: "practice",
      order: 2,
      kind: "PRACTICE",
      title: "Luyện tập Chủ đề chương I",
      description: "Làm bài luyện theo mục tiêu.",
      status: "ASSIGNED",
      actionUrl: "/student/practice",
      overdue: false,
      progress: { status: "NOT_STARTED", difficultyNote: null },
    },
  ],
  materialStudy: null,
};

function load() {
  const filename = path.resolve("components/assessment/student-learning-plans-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useParams: () => ({ id: "plan" }), useRouter: () => ({ push() {} }) };
    if (id === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/components/student/student-shell") return { StudentShell: ({ children }) => React.createElement("main", null, children) };
    if (id === "@/components/ui/button") return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/assessment/student-improvement-panel") return { StudentImprovementPanel: () => null };
    if (id === "@/lib/assessment-api") return { learningPlanService: { getMine: async () => plan, listMine: async () => [plan] } };
    if (id === "@/lib/learning-support-api") return {
      LEARNING_SUPPORT_CHANGED_EVENT: "support-changed",
      learningSupportService: { listStudent: async () => [], markStudentRead: async () => null },
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

test("learning plan renders friendly task statuses and a readable progress layout", async (t) => {
  const { StudentLearningPlansPage } = load();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(StudentLearningPlansPage, { detail: true }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const shown = visibleText(renderer.toJSON());
  assert.match(shown, /Mục tiêu ôn tập/);
  assert.match(shown, /Tiêu chí đánh giá lại/);
  assert.match(shown, /Tiến độ 0\/2 bước/);
  assert.match(shown, /Các bước thực hiện/);
  assert.match(shown, /Chưa bắt đầu/);
  assert.doesNotMatch(shown, /NOT_STARTED/);
});
