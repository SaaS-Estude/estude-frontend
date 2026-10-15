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

test("material plan practice saves the scored attempt and reloads threshold progress", async (t) => {
  const filename = path.resolve("components/assessment/material-plan-practice-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  const calls = [];
  let submitted = false;
  const plan = () => ({
    id: "plan", title: "Ôn Lịch sử", classId: "class", subjectId: "subject",
    targetAccuracyPercent: 70,
    objective: { granularity: "MATERIAL" },
    tasks: [{ kind: "PRACTICE", practiceSetId: "practice" }],
    materialStudy: {
      materialId: "material", materialName: "Lịch sử.pdf", sourceAttemptId: "source",
      baselineExamAccuracy: 40, missedCount: 2, matchedCount: 1,
      latestScore: submitted ? 80 : null, passed: submitted, practiceScoreChange: null,
      sections: [{ title: "Mục 1", page: 3, missedCount: 1, theory: "Lý thuyết có nguồn",
        keyPoints: [], mistakes: [{ questionId: "old-q", content: "Câu hỏi từng sai",
          selectedAnswer: "Bỏ trống", correctAnswer: "Đáp án đúng", explanation: "Vì vậy" }],
        citations: [{ documentName: "Lịch sử.pdf", page: 3, excerpt: "Đoạn trích" }] }],
    },
  });
  const practice = (status) => ({ id: "practice", attemptId: "attempt", status,
    questions: [{ id: "q1", selectedOptionIds: status === "SUBMITTED" ? ["a"] : [] }],
    totalQuestions: 1, correctCount: status === "SUBMITTED" ? 1 : null });
  loaded.require = (id) => {
    if (id === "next/link") return { default: (props) => React.createElement("a", props) };
    if (id === "next/navigation") return { useParams: () => ({ id: "plan" }) };
    if (id === "@/components/student/student-shell") return { StudentShell: (props) => React.createElement("main", props) };
    if (id === "@/components/assessment/study-analysis-page") return {
      PracticeSection: (props) => React.createElement("practice-section", props),
    };
    if (id === "@/lib/assessment-api") return {
      learningPlanService: { getMine: async () => plan(), getPracticeSet: async () => practice("READY") },
      examAttemptService: {
        startStudyPractice: async () => practice("READY"),
        submitStudyPractice: async (...args) => { calls.push(args); submitted = true; return practice("SUBMITTED"); },
        retryStudyPractice: async () => practice("READY"),
        getStudyPracticeHint: async () => ({ message: "Gợi ý" }),
      },
    };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports.MaterialPlanPracticePage));
    await new Promise(setImmediate); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  assert.match(JSON.stringify(renderer.toJSON()), /Lý thuyết có nguồn/);
  assert.match(JSON.stringify(renderer.toJSON()), /Đoạn trích/);
  assert.match(JSON.stringify(renderer.toJSON()), /Câu hỏi từng sai/);
  const section = () => renderer.root.findByType("practice-section");
  await act(async () => section().props.onChoose("q1", "a"));
  await act(async () => { section().props.onSubmit(); await new Promise(setImmediate); });
  assert.deepEqual(calls[0], ["practice", "attempt", [{ questionId: "q1", selectedOptionIds: ["a"] }]]);
  assert.match(JSON.stringify(renderer.toJSON()), /Đã đạt ngưỡng hoàn thành/);
});
