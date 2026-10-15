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

const flush = () => new Promise(setImmediate);
async function renderOverview(t, { count = 1, allowed = true } = {}) {
  const calls = [];
  const filename = path.resolve("components/assessment/exam-results-overview.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => ({ push: (route) => calls.push(["route", route]) }) };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/context/permissions-context") return { usePermissions: () => ({ can: () => allowed, loading: false }) };
    if (id === "@/components/ui/button") return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/assessment/submissions-page") return {
      ReportOverviewDashboard: ({ report, compact }) => React.createElement("div", { "data-chart": true, "data-compact": compact }, report.summary.submittedStudentCount),
      ClassAiAnalysisPanel: ({ analysis }) => React.createElement("div", { "data-analysis": true }, analysis.headline),
    };
    if (id === "@/lib/assessment-api") return { examService: {
      getClassReport: async (examId) => {
        calls.push(["report", examId]);
        return { summary: { enrolledStudentCount: 3, submittedStudentCount: count, averageScore: count ? 0 : null, averageDurationSeconds: count ? 60 : null } };
      },
      analyzeClassReport: async (examId) => {
        calls.push(["ai", examId]);
        throw new Error("Overview must navigate instead of generating AI");
      },
    } };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports.ExamResultsOverview, { examId: "exam", totalPoints: 10 })); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return { renderer, calls, text: () => JSON.stringify(renderer.toJSON()) };
}

test("loads statistics and opens the dedicated AI tab without starting an inline analysis", async (t) => {
  const { renderer, calls, text } = await renderOverview(t);
  assert.deepEqual(calls, [["report", "exam"]]);
  assert.match(text(), /0\/10/);
  assert.equal(renderer.root.findByProps({ "data-chart": true }).props["data-compact"], true);
  await act(async () => { renderer.root.findByType("button").props.onClick(); await flush(); });
  assert.deepEqual(calls, [["report", "exam"], ["route", "/teacher/exams/exam/analysis"]]);
});

test("keeps the AI tab accessible to view any saved report even without current submissions", async (t) => {
  const { renderer, calls, text } = await renderOverview(t, { count: 0 });
  assert.match(text(), /Cần ít nhất một học sinh nộp bài/);
  await act(async () => renderer.root.findByType("button").props.onClick());
  assert.deepEqual(calls, [["report", "exam"], ["route", "/teacher/exams/exam/analysis"]]);
});

test("does not fetch statistics without submission permission", async (t) => {
  const { calls, text } = await renderOverview(t, { allowed: false });
  assert.deepEqual(calls, []);
  assert.match(text(), /Bạn chưa có quyền xem thống kê/);
});
