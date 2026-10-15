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

function load(analysis, plans, onList) {
  const filename = path.resolve("components/assessment/study-analysis-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return {
      useParams: () => ({ id: "attempt" }),
      useRouter: () => ({ push() {}, back() {} }),
      useSearchParams: () => new URLSearchParams(""),
    };
    if (id === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (id === "@/lib/study-analysis-loader") return { loadOrCreateStudentStudyAnalysis: async () => analysis };
    if (id === "@/lib/assessment-api") return {
      examAttemptService: {},
      learningPlanService: { listMine: async () => { onList(); return plans; } },
    };
    if (id === "@/components/student/student-shell") return { StudentShell: ({ children }) => React.createElement("div", null, children) };
    if (id === "@/components/assessment/assessment-shell") return { ErrorPanel: () => null };
    if (id === "@/components/assessment/study-activity-dashboard") return { StudyActivityDashboard: () => null };
    if (id === "@/components/assessment/study-analysis-details") return {
      StudyAnalysisDetails: () => null, ReviewLabel: () => null, FeedbackControl: () => null, sourceMeta: {},
    };
    if (id === "@/components/assessment/practice-attempt-history") return { PracticeAttemptHistory: () => null };
    if (id === "@/components/assessment/study-practice-history") return { StudyPracticeHistory: () => null };
    if (id === "@/components/ui/button") return { Button: (props) => React.createElement("button", props) };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

const report = (needsWarning) => ({
  analysisScope: "MATERIAL_GROUNDED",
  aiStatus: "READY",
  exam: { classId: "class", subjectId: "subject", subjectName: "Lịch sử", className: "12A" },
  performance: { needsWarning, correctCount: needsWarning ? 4 : 7, totalQuestions: 10, score: needsWarning ? 4 : 7, totalPoints: 10, accuracy: needsWarning ? 40 : 70, ungradedEssayCount: 0 },
  learningPath: { steps: [], totalDurationMinutes: 0 },
  summary: "Gợi ý ôn thêm",
});
const plan = { id: "plan", classId: "class", subjectId: "subject", status: "ASSIGNED" };

async function render(t, needsWarning, plans = [plan]) {
  let listCalls = 0;
  const { StudentStudyAnalysisPage } = load(
    { id: "analysis", generatedAt: "2026-09-30T09:00:00Z", report: report(needsWarning), practiceSet: null },
    plans,
    () => { listCalls += 1; },
  );
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(StudentStudyAnalysisPage));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return { renderer, listCalls };
}

test("the teacher-assigned support link stays hidden for a 7/10 student", async (t) => {
  const { renderer, listCalls } = await render(t, false);
  assert.equal(listCalls, 0);
  assert.equal(renderer.root.findAllByType("a").some((link) => link.props.href?.includes("learning-plans")), false);
});

test("the teacher-assigned support link opens an assigned plan for a weak result", async (t) => {
  const { renderer, listCalls } = await render(t, true);
  assert.equal(listCalls, 1);
  assert.equal(renderer.root.findAllByType("a").some((link) => link.props.href === "/student/learning-plans/plan"), true);
});

test("a weak result without an assigned plan has no teacher-plan link", async (t) => {
  const { renderer, listCalls } = await render(t, true, []);
  assert.equal(listCalls, 1);
  assert.equal(renderer.root.findAllByType("a").some((link) => link.props.href?.includes("learning-plans")), false);
});
