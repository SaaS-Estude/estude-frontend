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

function loadComponent(filename, api) {
  const absolute = path.resolve(filename);
  const loaded = new Module(absolute, module);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/lib/assessment-api") return api;
    if (id === "@/lib/auth-api")
      return { ApiError: class ApiError extends Error {} };
    if (id === "next/link")
      return {
        __esModule: true,
        default: ({ href, children, ...props }) =>
          React.createElement("a", { href, ...props }, children),
      };
    if (id === "@/components/ui/button")
      return {
        Button: ({ children, ...props }) =>
          React.createElement("button", props, children),
      };
    return originalRequire(id);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    absolute,
  );
  return loaded.exports;
}

test("teacher can inspect a source and select a baseline with the current version", async (t) => {
  const evidence = {
    id: "evidence-new",
    objectiveId: "objective",
    source: "ASSIGNED_EXAM",
    sourceTitle: "Bài đầu kỳ",
    sourceAttemptId: "attempt",
    examId: "exam",
    observedAt: "2026-09-20T10:00:00Z",
    totalQuestions: 1,
    scorableCount: 1,
    correctCount: 0,
    accuracy: 0,
    gradingStatus: "COMPLETE",
    snapshotOrigin: "ORIGINAL",
    assistance: "NO_SYSTEM_HINTS",
    gradingVersion: "exact-options-v1",
    objective: { id: "objective", key: "topic:algebra", title: "Đại số" },
    questionSnapshot: [
      {
        questionId: "question",
        content: "2 + 2?",
        type: "SINGLE_CHOICE",
        difficulty: "EASY",
        points: 1,
        options: [
          { id: "a", label: "A", text: "4" },
          { id: "b", label: "B", text: "5" },
        ],
        correctOptionIds: ["a"],
      },
    ],
    answers: [{ questionId: "question", selectedOptionIds: ["b"] }],
    baselineEligible: true,
    ineligibleReason: null,
  };
  const baseline = {
    id: "selection",
    objectiveId: "objective",
    evidenceId: "old",
    teacherId: "teacher",
    reason: "Cũ",
    version: 2,
    selectedAt: "2026-09-19T10:00:00Z",
  };
  const bundle = {
    items: [evidence],
    baselines: [baseline],
    baselineHistory: [],
    missingSnapshotAttemptIds: [],
  };
  const selected = [];
  const { StudyEvidencePanel } = loadComponent(
    "components/assessment/study-evidence-panel.tsx",
    {
      examService: {
        getStudentEvidenceBundle: async () => bundle,
        selectStudentBaselineRecord: async (examId, studentId, input) => {
          selected.push({ examId, studentId, input });
        },
      },
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(StudyEvidencePanel, {
        examId: "exam",
        studentId: "student",
        plans: [
          {
            objectiveId: "objective",
            status: "ASSIGNED",
            targetAccuracyPercent: 70,
            successCriteria: "Đúng ít nhất 7/10 câu",
          },
        ],
      }),
    );
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  assert.match(JSON.stringify(renderer.toJSON()), /Đại số/);
  assert.match(JSON.stringify(renderer.toJSON()), /Đúng 0 trên 1 câu \(0%\)/);
  assert.match(JSON.stringify(renderer.toJSON()), /Ít nhất 70%/);
  assert.match(JSON.stringify(renderer.toJSON()), /Đúng ít nhất 7\/10 câu/);
  const buttons = () => renderer.root.findAllByType("button");
  await act(async () =>
    buttons()
      .find((button) => button.children.includes("Chọn làm kết quả hiện tại"))
      .props.onClick(),
  );
  await act(async () =>
    renderer.root
      .findByType("textarea")
      .props.onChange({ target: { value: "Bài chẩn đoán đầu tiên" } }),
  );
  await act(async () => {
    buttons()
      .find((button) => button.children.includes("Xác nhận lưu kết quả"))
      .props.onClick();
    await flush();
  });
  assert.deepEqual(selected, [
    {
      examId: "exam",
      studentId: "student",
      input: {
        evidenceId: "evidence-new",
        reason: "Bài chẩn đoán đầu tiên",
        expectedVersion: 2,
      },
    },
  ]);
});

test("an unclassified question is excluded from progress tracking", async (t) => {
  const evidence = {
    id: "single",
    objectiveId: "objective-single",
    source: "ASSIGNED_EXAM",
    sourceTitle: "Kiểm tra Sinh học",
    sourceAttemptId: "attempt",
    examId: "exam",
    observedAt: "2026-09-27T08:30:00Z",
    totalQuestions: 1,
    scorableCount: 1,
    correctCount: 0,
    accuracy: 0,
    gradingStatus: "COMPLETE",
    snapshotOrigin: "ORIGINAL",
    assistance: "NO_SYSTEM_HINTS",
    gradingVersion: "exact-options-v1",
    objective: {
      id: "objective-single",
      key: "question:internal-id",
      title: "Câu hỏi chưa gắn chủ đề",
      granularity: "QUESTION",
    },
    questionSnapshot: [
      {
        questionId: "question",
        content: "Câu hỏi Sinh học",
        type: "SINGLE_CHOICE",
        difficulty: "EASY",
        points: 1,
        options: [
          { id: "a", label: "A", text: "Sai" },
          { id: "b", label: "B", text: "Đúng" },
        ],
        correctOptionIds: ["b"],
      },
    ],
    answers: [],
    baselineEligible: true,
    ineligibleReason: null,
  };
  const { StudyEvidencePanel } = loadComponent(
    "components/assessment/study-evidence-panel.tsx",
    {
      examService: {
        getStudentEvidenceBundle: async () => ({
          items: [evidence],
          baselines: [],
          baselineHistory: [],
          missingSnapshotAttemptIds: [],
        }),
      },
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(StudyEvidencePanel, {
        examId: "exam",
        studentId: "student",
      }),
    );
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  const shown = JSON.stringify(renderer.toJSON());
  assert.match(shown, /Theo dõi tiến bộ sau ôn tập/);
  assert.match(shown, /Chưa thể theo dõi tiến bộ/);
  assert.match(shown, /xác nhận chủ đề ở phần Phân loại chủ đề từ tài liệu/);
  assert.doesNotMatch(shown, /Đúng 0 trên 1 câu \(0%\)/);
  assert.doesNotMatch(shown, /Chọn kết quả hiện tại từ bài đã làm/);
});

test("student opens an old submitted attempt without changing the current one", async (t) => {
  const history = [
    {
      id: "old",
      attemptNumber: 1,
      status: "SUBMITTED",
      submittedAt: "2026-09-20T10:00:00Z",
      mode: "EASY",
      correctCount: 0,
      totalQuestions: 1,
      assistance: "SYSTEM_HINTS_USED",
    },
  ];
  const practice = { id: "set", attemptId: "current", attemptHistory: history };
  const calls = [];
  const { StudyPracticeHistory } = loadComponent(
    "components/assessment/study-practice-history.tsx",
    {
      examAttemptService: {
        getStudyPracticeAttempt: async (setId, attemptId) => {
          calls.push([setId, attemptId]);
          return {
            ...history[0],
            questions: [
              {
                id: "question",
                topicName: "Đại số",
                content: "2 + 2?",
                options: [{ id: "a", label: "A", text: "4" }],
                selectedOptionIds: ["a"],
                correctOptionIds: ["a"],
              },
            ],
            snapshotVersion: "v1",
            gradingVersion: "exact-options-v1",
          };
        },
      },
    },
  );
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(StudyPracticeHistory, { practice }));
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  await act(async () => {
    renderer.root.findByType("button").props.onClick();
    await flush();
  });
  assert.deepEqual(calls, [["set", "old"]]);
  assert.match(JSON.stringify(renderer.toJSON()), /2 \+ 2\?/);
  assert.equal(practice.attemptId, "current");
});
