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
const textOf = (node) =>
  typeof node === "string" || typeof node === "number" ? String(node)
    : Array.isArray(node) ? node.map(textOf).join("")
      : React.isValidElement(node) ? textOf(node.props.children)
      : textOf(node?.children ?? []);

function load(api) {
  const filename = path.resolve("components/assessment/teacher-study-progress.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/lib/assessment-api") return api;
    if (id === "@/lib/study-activity-review") {
      const helper = path.resolve("lib/study-activity-review.ts");
      const helperModule = new Module(helper, module);
      helperModule.filename = helper;
      helperModule.paths = Module._nodeModulePaths(path.dirname(helper));
      helperModule._compile(ts.transpileModule(fs.readFileSync(helper, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, helper);
      return helperModule.exports;
    }
    if (id === "next/link") return { __esModule: true, default: (props) => React.createElement("a", props) };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/modal")
      return { Modal: ({ open, title, children }) => open ? React.createElement("div", null, title, children) : null };
    return originalRequire(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

test("teacher sees exam analyses, practice rounds and document viewing separately", async (t) => {
  const calls = [];
  const detailCalls = [];
  const activity = {
    activityReview: { source: "AI", comment: "Học sinh đã bắt đầu đọc tài liệu và kết quả lượt luyện thứ hai có cải thiện. Nên luyện thêm câu về mốc thời gian.", generatedAt: "2026-09-30T09:16:00Z", model: "gemini-test" },
    analysisHistory: [
      { id: "analysis-1", examId: "exam-1", attemptId: "attempt-1", examTitle: "Bài đầu", generatedAt: "2026-09-20T08:00:00Z", score: 5, totalPoints: 10, accuracy: 50, aiStatus: "READY", summary: "Cần ôn mốc thời gian", weakAreaCount: 2 },
      { id: "analysis-2", examId: "exam", attemptId: "attempt-2", examTitle: "Bài sau", generatedAt: "2026-09-30T08:00:00Z", score: 7, totalPoints: 10, accuracy: 70, aiStatus: "READY", summary: "Đã nắm tốt hơn", weakAreaCount: 1 },
    ],
    practice: [
      { id: "practice-1", attemptNumber: 1, status: "SUBMITTED", startedAt: "2026-09-30T08:58:00Z", submittedAt: "2026-09-30T09:00:00Z", correctCount: 1, totalQuestions: 3, durationSeconds: 120, assistance: "NO_SYSTEM_HINTS" },
      { id: "practice-2", attemptNumber: 2, status: "SUBMITTED", startedAt: "2026-09-30T09:08:00Z", submittedAt: "2026-09-30T09:10:00Z", correctCount: 2, totalQuestions: 3, durationSeconds: 100, assistance: "NO_SYSTEM_HINTS" },
      { id: "practice-3", attemptNumber: 3, status: "READY", startedAt: "2026-09-30T09:15:00Z", submittedAt: null, correctCount: 0, totalQuestions: 3, durationSeconds: 0, assistance: "UNKNOWN" },
    ],
    materialViews: [{ id: "view", materialId: "material", materialName: "Lịch sử.pdf", openedAt: "2026-09-30T08:30:00Z", lastActiveAt: "2026-09-30T08:32:00Z", closedAt: "2026-09-30T08:32:00Z", activeSeconds: 90 }],
    materials: [],
  };
  const { TeacherStudyProgress } = load({
    examService: {
      getTeacherStudyActivity: async (...args) => {
        calls.push(args);
        return activity;
      },
      getTeacherStudyPracticeAttempt: async (...args) => {
        detailCalls.push(args);
        return {
          ...activity.practice[1],
          questions: [{
            id: "question",
            topicName: "Chủ đề chương I",
            content: "Mốc thời gian nào là chính xác?",
            correct: false,
            selectedOptionIds: ["a"],
            correctOptionIds: ["b"],
            explanation: "Đối chiếu lại mốc thời gian trong tài liệu.",
            options: [
              { id: "a", label: "A", text: "1944" },
              { id: "b", label: "B", text: "1945" },
            ],
          }],
        };
      },
    },
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(TeacherStudyProgress, { examId: "exam", studentId: "student", attemptId: "attempt-2" }));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  const shown = textOf(renderer.toJSON());
  assert.deepEqual(calls, [["exam", "student", "attempt-2"]]);
  assert.match(shown, /Bài đầu/);
  assert.match(shown, /Bài sau/);
  assert.match(shown, /Lượt 1/);
  assert.match(shown, /Lịch sử\.pdf/);
  assert.match(shown, /Nhận xét AI về quá trình ôn tập/);
  assert.match(shown, /Bài kiểm tra đã phân tích/);
  assert.match(shown, /Hoạt động/);
  assert.match(shown, /Xu hướng kết quả/);
  assert.match(shown, /Đề xuất tiếp theo/);
  assert.match(shown, /kết quả lượt luyện thứ hai có cải thiện/);
  assert.match(shown, /AI cập nhật lúc/);
  assert.doesNotMatch(shown, /Nhận xét sau bài luyện theo chủ đề/);
  assert.doesNotMatch(shown, /Lộ trình hỗ trợ do giáo viên giao được quản lý riêng/);
  assert.deepEqual(renderer.root.findAllByType("a").map((link) => link.props.href), ["/teacher/exams/exam-1/submissions/attempt-1"]);
  const detailButton = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button.props.children).includes("Xem chi tiết"));
  await act(async () => {
    detailButton.props.onClick();
    await new Promise(setImmediate);
  });
  const detailShown = textOf(renderer.toJSON());
  assert.deepEqual(detailCalls, [["exam", "student", "attempt-2", "practice-1"]]);
  assert.match(detailShown, /Mốc thời gian nào là chính xác/);
  assert.match(detailShown, /Học sinh chọn/);
  assert.match(detailShown, /Đáp án đúng/);
});

test("teacher can retry a failed AI study activity review", async (t) => {
  const retryCalls = [];
  const { TeacherStudyProgressFeedback } = load({
    examService: {
      regenerateTeacherStudyActivityReview: async (...args) => {
        retryCalls.push(args);
        return {
          source: "AI",
          comment: "Lượt luyện gần nhất đã cải thiện; học sinh nên tiếp tục ôn mốc thời gian.",
          generatedAt: "2026-09-30T10:00:00Z",
          model: "gemini-test",
        };
      },
    },
  });
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(TeacherStudyProgressFeedback, {
      data: {
        activityReview: {
          source: "ERROR",
          comment: null,
          generatedAt: "2026-09-30T09:59:00Z",
          model: null,
        },
      },
      examId: "exam",
      studentId: "student",
      attemptId: "attempt",
    }));
  });
  t.after(async () => act(async () => renderer.unmount()));
  const retryButton = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button.props.children).includes("Tạo lại nhận xét AI"));
  await act(async () => {
    retryButton.props.onClick();
    await new Promise(setImmediate);
  });
  assert.deepEqual(retryCalls, [["exam", "student", "attempt"]]);
  assert.match(
    textOf(renderer.toJSON()),
    /Lượt luyện gần nhất đã cải thiện/,
  );
});
