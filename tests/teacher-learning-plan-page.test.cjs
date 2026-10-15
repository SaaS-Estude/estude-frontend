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

const visibleText = (node) =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(visibleText).join("")
      : node?.children
        ? visibleText(node.children)
        : "";

const draftPlan = {
  id: "plan",
  cohortId: "cohort",
  examId: "exam",
  studentId: "student",
  teacherId: "teacher",
  classId: "class",
  subjectId: "subject",
  objectiveId: "objective",
  title: "Ôn tập Chủ đề chương I",
  summary: "Củng cố kiến thức nền tảng.",
  successCriteria: "Đọc tài liệu và đạt ít nhất 70% ở bài luyện.",
  targetAccuracyPercent: 70,
  dueAt: "2026-09-30T16:37:00.000Z",
  status: "DRAFT",
  version: 2,
  baselineEvidenceId: null,
  approvedAt: null,
  objective: { id: "objective", title: "Chủ đề chương I" },
  tasks: [
    {
      id: "material-task",
      planId: "plan",
      order: 1,
      kind: "MATERIAL",
      title: "Đọc tài liệu Chủ đề chương I",
      description: "Đọc tài liệu đã gắn.",
      materialId: "material",
      practiceSetId: null,
      actionUrl: null,
      dueAt: null,
      status: "DRAFT",
      version: 1,
      overdue: false,
      progress: null,
    },
    {
      id: "practice-task",
      planId: "plan",
      order: 2,
      kind: "PRACTICE",
      title: "Luyện tập Chủ đề chương I",
      description: "Làm bộ câu luyện riêng.",
      materialId: null,
      practiceSetId: null,
      actionUrl: null,
      dueAt: null,
      status: "DRAFT",
      version: 1,
      overdue: false,
      progress: null,
    },
  ],
  history: [],
};

const assignedPlan = {
  ...draftPlan,
  status: "IN_PROGRESS",
  tasks: draftPlan.tasks.map((task) => ({
    ...task,
    status: "ASSIGNED",
    practiceSetId: task.kind === "PRACTICE" ? "practice-set" : null,
  })),
};

const practicePreview = {
  planId: "plan",
  taskId: "practice-task",
  practiceSetId: "practice-set",
  totalQuestions: 1,
  questions: [
    {
      id: "question-1",
      type: "SINGLE_CHOICE",
      topicName: "Chủ đề chương I",
      sourceType: "COURSE_MATERIAL",
      content: "Thủ đô của Việt Nam là thành phố nào?",
      options: [
        { id: "a", label: "A", text: "Hà Nội" },
        { id: "b", label: "B", text: "Huế" },
      ],
      correctOptionIds: ["a"],
      explanation: "Hà Nội là thủ đô của Việt Nam.",
    },
  ],
};

async function renderPage(
  t,
  { plan = draftPlan, preview = practicePreview } = {},
) {
  const publishCalls = [];
  const previewCalls = [];
  const filename = path.resolve(
    "components/assessment/teacher-learning-plan-page.tsx",
  );
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/link")
      return { default: (props) => React.createElement("a", props) };
    if (id === "next/navigation") return { useParams: () => ({ id: "plan" }) };
    if (id === "lucide-react") {
      const Icon = (props) => React.createElement("icon", props);
      return {
        ArrowLeft: Icon,
        BookOpen: Icon,
        CalendarDays: Icon,
        CheckCircle2: Icon,
        ChevronDown: Icon,
        FileText: Icon,
        Send: Icon,
        Target: Icon,
      };
    }
    if (id === "@/components/assessment/assessment-shell")
      return {
        AssessmentShell: ({ children }) =>
          React.createElement("main", null, children),
        ErrorPanel: ({ message }) =>
          React.createElement("error-panel", null, message),
        LoadingPanel: () => React.createElement("loading-panel"),
      };
    if (id === "@/components/assessment/learning-improvement-panel")
      return {
        TeacherImprovementPanel: () => React.createElement("improvement-panel"),
      };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/action-notification")
      return { useActionNotification: () => ({ notify: () => {} }) };
    if (id === "@/lib/assessment-api")
      return {
        learningPlanService: {
          getTeacher: async () => plan,
          getTeacherPracticePreview: async (planId) => {
            previewCalls.push(planId);
            return preview;
          },
          publish: async (planId, version) => {
            publishCalls.push({ planId, version });
            return {
              ...plan,
              status: "ASSIGNED",
              version: version + 1,
              tasks: plan.tasks.map((task) => ({
                ...task,
                status: "ASSIGNED",
              })),
            };
          },
        },
      };
    return originalRequire(id);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );

  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(loaded.exports.TeacherLearningPlanPage),
    );
    await Promise.resolve();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return { renderer, publishCalls, previewCalls };
}

test("teacher sees draft tasks and can approve the plan", async (t) => {
  const { renderer, publishCalls } = await renderPage(t);
  const initialText = visibleText(renderer.toJSON());

  assert.match(initialText, /Nội dung cần hoàn thành/);
  assert.match(initialText, /Đọc tài liệu Chủ đề chương I/);
  assert.match(initialText, /Luyện tập Chủ đề chương I/);
  assert.match(initialText, /Học sinh chưa nhìn thấy lộ trình này/);
  assert.equal(renderer.root.findAllByType("improvement-panel").length, 0);

  const approve = renderer.root
    .findAllByType("button")
    .find((button) => visibleText(button).includes("Duyệt và giao"));
  assert.ok(approve);

  await act(async () => {
    approve.props.onClick();
    await Promise.resolve();
  });

  assert.deepEqual(publishCalls, [{ planId: "plan", version: 2 }]);
  assert.match(visibleText(renderer.toJSON()), /Đã duyệt và giao lộ trình/);
  assert.match(visibleText(renderer.toJSON()), /Học sinh đang thực hiện/);
});

test("teacher can review practice questions, correct answers, and explanations", async (t) => {
  const { renderer, previewCalls } = await renderPage(t, {
    plan: assignedPlan,
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const text = visibleText(renderer.toJSON());
  assert.deepEqual(previewCalls, ["plan"]);
  assert.match(text, /Xem trước bộ câu luyện · 1 câu/);
  assert.match(text, /Thủ đô của Việt Nam là thành phố nào/);
  assert.match(text, /Hà Nội/);
  assert.match(text, /Hà Nội là thủ đô của Việt Nam/);
});
