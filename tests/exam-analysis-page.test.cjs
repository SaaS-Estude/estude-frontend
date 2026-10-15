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
global.window = { addEventListener() {}, removeEventListener() {} };
const flush = () => new Promise(setImmediate);
const childText = (value) =>
  Array.isArray(value)
    ? value.map(childText).join("")
    : React.isValidElement(value)
      ? childText(value.props.children)
      : typeof value === "string"
        ? value
        : "";

const analysis = {
  generatedAt: "2026-09-21T15:00:00Z",
  source: "AI",
  model: "internal-model-id",
  headline: "Báo cáo đã lưu",
  summary: "Cần củng cố Hình học.",
  strengths: [],
  concerns: [],
  recommendations: [],
  lessonPlan: {
    focus: "Hình học",
    objective: "Ôn tập",
    activities: ["Luyện tập"],
    durationMinutes: 30,
  },
};
const empty = {
  status: "NOT_STARTED",
  analysis: null,
  snapshot: null,
  hasNewData: false,
  canAnalyze: true,
  currentSubmittedStudentCount: 1,
  error: null,
};
const saved = {
  ...empty,
  status: "READY",
  analysis,
  snapshot: {
    title: "Kiểm tra",
    className: "12A",
    subjectName: "Toán",
    totalPoints: 10,
    enrolledStudentCount: 8,
    submittedStudentCount: 1,
    averagePercentage: 20,
    averageDurationSeconds: 90,
  },
};

async function renderPage(t, initial, allowed = true, reportFixture = null) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = { current: initial, requests: [], gets: 0, actions: [] };
  const filename = path.resolve("components/assessment/exam-analysis-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useParams: () => ({ id: "exam" }) };
    if (id === "lucide-react")
      return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/context/permissions-context")
      return { usePermissions: () => ({ can: () => allowed, loading: false }) };
    if (id === "@/components/assessment/assessment-shell")
      return { AssessmentShell: (props) => React.createElement("main", props) };
    if (id === "@/components/assessment/exam-detail-tabs")
      return {
        ExamDetailTabs: () => React.createElement("nav", null, "Phân tích AI"),
      };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/form-control")
      return { Textarea: (props) => React.createElement("textarea", props) };
    if (id === "@/components/ui/action-notification")
      return { useActionNotification: () => ({ notify() {} }) };
    if (id === "@/lib/subject-localization")
      return { toVietnameseSubjectName: (value) => value };
    if (id === "@/lib/assessment-api")
      return {
        examService: {
          getExamById: async () => ({
            id: "exam",
            title: "Kiểm tra",
            classId: "class",
            className: "12A",
            subjectId: "subject",
            subjectName: "Toán",
          }),
          getClassReport: async () => {
            if (reportFixture) return reportFixture;
            throw new Error("report fixture not needed");
          },
          getClassAnalysis: async () => {
            store.gets++;
            return store.current;
          },
          analyzeClassReport: async (examId, refresh = false) => {
            store.requests.push({ examId, refresh });
            store.current = { ...store.current, status: "QUEUED", error: null };
            return store.current;
          },
          createInsightAction: async (examId, payload) => {
            store.actions.push({ examId, payload });
            return {
              id: "notification",
              recipientCount: payload.studentIds.length,
              alreadySent: false,
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
  const mount = async () => {
    await act(async () => {
      renderer = create(React.createElement(loaded.exports.ExamAnalysisPage));
      await flush();
    });
  };
  await mount();
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return {
    store,
    text: () => JSON.stringify(renderer.toJSON()),
    button: () => renderer.root.findByType("button"),
    buttons: () => renderer.root.findAllByType("button"),
    tick: async (ms = 3_000) => {
      await act(async () => {
        t.mock.timers.tick(ms);
        await flush();
      });
    },
    remount: async () => {
      await act(async () => renderer.unmount());
      await mount();
    },
  };
}

test("reopening a saved report never calls AI and hides model metadata", async (t) => {
  const page = await renderPage(t, saved);
  assert.match(page.text(), /Báo cáo đã lưu/);
  assert.match(page.text(), /Đã lưu báo cáo/);
  assert.doesNotMatch(page.text(), /internal-model-id/);
  await page.remount();
  assert.deepEqual(page.store.requests, []);
});

test("shows exam-risk only and hides learning guidance when no course material is attached", async (t) => {
  const page = await renderPage(t, {
    ...saved,
    analysis: {
      ...analysis,
      source: "ASSESSMENT_ONLY",
      analysisScope: "ASSESSMENT_ONLY",
      headline: "42,9% học sinh thuộc nhóm cần hỗ trợ",
      materialContext: { available: false, readyMaterialCount: 0 },
      riskSummary: {
        basis: "EXAM_RESULTS_ONLY",
        atRiskStudentCount: 3,
        evaluatedStudentCount: 7,
        atRiskPercentage: 42.9,
      },
    },
  });

  assert.match(page.text(), /42,9%/);
  assert.match(page.text(), /không gọi AI và không tạo lộ trình/);
  assert.doesNotMatch(page.text(), /Kế hoạch hỗ trợ/);
  assert.doesNotMatch(page.text(), /Giao bài ôn tập/);
});

test("waits for explicit confirmation before the first analysis, resumes polling after reload, then displays the persisted result", async (t) => {
  const page = await renderPage(t, empty);
  assert.deepEqual(page.store.requests, []);
  assert.match(page.text(), /Phân tích AI/);
  await act(async () => {
    page.button().props.onClick();
    await flush();
  });
  assert.deepEqual(page.store.requests, [{ examId: "exam", refresh: true }]);
  assert.match(page.text(), /Đã tiếp nhận yêu cầu/);
  await page.remount();
  assert.equal(page.store.requests.length, 1);
  page.store.current = saved;
  await page.tick();
  assert.match(page.text(), /Đã lưu báo cáo/);
  assert.equal(page.button().props.disabled, false);
});

test("new data requires explicit refresh, with the saved report preserved through processing and failure", async (t) => {
  const page = await renderPage(t, {
    ...saved,
    hasNewData: true,
    currentSubmittedStudentCount: 2,
  });
  assert.match(page.text(), /Có dữ liệu mới/);
  assert.deepEqual(page.store.requests, []);
  await act(async () => {
    page.button().props.onClick();
    await flush();
  });
  assert.deepEqual(page.store.requests, [{ examId: "exam", refresh: true }]);
  assert.match(page.text(), /Báo cáo đã lưu/);
  assert.equal(page.button().props.disabled, true);
  page.store.current = {
    ...page.store.current,
    status: "FAILED",
    error: "Dịch vụ chưa sẵn sàng",
  };
  await page.tick();
  assert.match(page.text(), /Dịch vụ chưa sẵn sàng/);
  assert.match(page.text(), /Báo cáo trước đó vẫn được giữ/);
  assert.match(page.text(), /Báo cáo đã lưu/);
  assert.equal(page.store.requests.length, 1);
});

test("does not start AI for an empty exam", async (t) => {
  const page = await renderPage(t, {
    ...empty,
    canAnalyze: false,
    currentSubmittedStudentCount: 0,
  });
  assert.match(page.text(), /Chưa có bài nộp/);
  assert.equal(page.button().props.disabled, true);
  assert.deepEqual(page.store.requests, []);
});

test("does not read or start analysis without permission", async (t) => {
  const page = await renderPage(t, empty, false);
  assert.match(page.text(), /Bạn chưa có quyền/);
  assert.equal(page.store.gets, 0);
  assert.deepEqual(page.store.requests, []);
});

test("turns a weak-topic insight into an assignment for the suggested student group", async (t) => {
  const report = {
    policy: { supportThresholdPercent: 60 },
    students: [
      { id: "student-a", needsSupport: true, participationStatus: "SUBMITTED" },
      { id: "student-b", needsSupport: true, participationStatus: "SUBMITTED" },
    ],
    topicPerformance: [
      {
        topicId: "topic-a",
        topicName: "Hình học",
        accuracy: 35,
        supportStudentIds: ["student-a", "student-b"],
      },
    ],
  };
  const page = await renderPage(t, saved, true, report);
  const assignmentButton = page
    .buttons()
    .find((button) =>
      childText(button.props.children).includes("Giao bài ôn tập"),
    );
  assert.ok(assignmentButton);
  await act(async () => {
    assignmentButton.props.onClick();
    await flush();
  });
  assert.equal(page.store.actions.length, 1);
  assert.deepEqual(page.store.actions[0].payload.studentIds, [
    "student-a",
    "student-b",
  ]);
  assert.equal(page.store.actions[0].payload.kind, "ASSIGNMENT");
  assert.match(page.store.actions[0].payload.message, /Kết quả|ngưỡng hỗ trợ/);
});
