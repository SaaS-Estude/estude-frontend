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
const childText = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : Array.isArray(value)
      ? value.map(childText).join("")
      : React.isValidElement(value)
        ? childText(value.props.children)
        : "";
const student = {
  id: "s1",
  fullName: "Nguyễn An",
  studentCode: "HS01",
  parentCount: 1,
  level: "HIGH",
  needsFollowUp: true,
  averagePercentage: 30,
  recentAveragePercentage: 30,
  trendPercentagePoints: null,
  scoredExamCount: 2,
  submittedExamCount: 2,
  overdueExamCount: 1,
  reasons: ["Hai bài có điểm dưới 50%."],
  history: [
    {
      examId: "exam1",
      title: "Lịch sử 1",
      endsAt: "2026-09-20",
      attemptId: "attempt1",
      status: "SUBMITTED",
      percentage: 30,
    },
  ],
  gaps: [
    {
      examId: "exam1",
      examTitle: "Lịch sử 1",
      questionId: "q1",
      questionNumber: 1,
      content: "Hội nghị Ianta năm 1945",
      topicName: "Trật tự thế giới",
    },
  ],
};
const report = {
  classId: "c",
  className: "12A",
  subjectId: "history",
  subjectName: "Lịch sử",
  version: "version1",
  generatedAt: "2026-09-21",
  examCount: 2,
  policy: "Không tính bài chưa nộp thành điểm 0",
  students: [student],
};

async function render(t, options = {}) {
  const calls = [];
  const filename = path.resolve(
    "components/assessment/subject-support-page.tsx",
  );
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useParams: () => ({ id: "exam" }) };
    if (id === "next/link")
      return {
        default: function MockLink(props) {
          return React.createElement("a", props);
        },
      };
    if (id === "lucide-react")
      return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/context/permissions-context")
      return {
        usePermissions: () => ({
          can: () => options.allowed !== false,
          loading: false,
        }),
      };
    if (id === "@/components/assessment/assessment-shell")
      return { AssessmentShell: (props) => React.createElement("main", props) };
    if (id === "@/components/assessment/exam-detail-tabs")
      return { ExamDetailTabs: () => null };
    if (id === "@/components/assessment/learning-support-group-panel")
      return { LearningSupportGroupPanel: () => null };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/content-loading")
      return {
        ContentLoading: ({ label }) => React.createElement("p", null, label),
        ContentLoadingOverlay: ({ label }) =>
          React.createElement("p", null, label),
      };
    if (id === "@/components/ui/form-control")
      return {
        Input: (props) => React.createElement("input", props),
        Textarea: (props) => React.createElement("textarea", props),
      };
    if (id === "@/components/ui/modal")
      return {
        Modal: ({ open, children, footer }) =>
          open
            ? React.createElement(
                "section",
                { "data-modal": true },
                children,
                footer,
              )
            : null,
      };
    if (id === "@/components/ui/data-table")
      return {
        Table: (props) => React.createElement("table", props),
        TableHeader: (props) => React.createElement("thead", props),
        TableBody: (props) => React.createElement("tbody", props),
        TableHead: (props) => React.createElement("th", props),
        TableCell: (props) => React.createElement("td", props),
        TableEmptyRow: ({ message }) =>
          React.createElement(
            "tr",
            null,
            React.createElement("td", null, message),
          ),
      };
    if (id === "@/lib/subject-localization")
      return { toVietnameseSubjectName: (value) => value };
    if (id === "@/lib/search-keyword")
      return {
        normalizeSearchKeyword: (...values) => values.join(" ").toLowerCase(),
        matchesSearchKeyword: (value, query) =>
          value.includes(query.toLowerCase()),
      };
    if (id === "@/lib/assessment-api")
      return {
        examService: {
          getSubjectSupport: async () => {
            calls.push("read");
            return options.report ?? report;
          },
          sendSupportAlert: async (examId, payload) => {
            calls.push({ examId, payload });
            if (options.fail) throw new Error("Dữ liệu đã thay đổi");
            return { recipientCount: 1 };
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
      options.initialReport
        ? React.createElement(loaded.exports.SubjectSupportDetail, {
            examId: "exam",
            initialReport: options.initialReport,
          })
        : React.createElement(loaded.exports.SubjectSupportPage),
    );
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  const button = (label) =>
    renderer.root
      .findAllByType("button")
      .find((item) => childText(item.props.children).includes(label));
  const open = async () => {
    await act(async () =>
      renderer.root
        .findByProps({ "aria-label": "Xem đánh giá của Nguyễn An" })
        .props.onClick(),
    );
  };
  return {
    renderer,
    calls,
    button,
    open,
    text: () => JSON.stringify(renderer.toJSON()),
  };
}

test("preloaded subject report renders without requesting it again", async (t) => {
  const page = await render(t, { initialReport: report });
  assert.match(page.text(), /Lịch sử/);
  assert.deepEqual(page.calls, []);
});

test("teacher reviews evidence and edits message before explicitly sending to linked parents", async (t) => {
  const page = await render(t);
  assert.match(page.text(), /Cần ưu tiên/);
  assert.deepEqual(page.calls, ["read"]);
  await page.open();
  assert.match(page.text(), /Hội nghị Ianta/);
  await act(async () => page.button("Thông báo phụ huynh").props.onClick());
  assert.match(page.text(), /Nội dung đầy đủ sẽ gửi/);
  assert.deepEqual(page.calls, ["read"]);
  await act(async () =>
    page.renderer.root.findByType("textarea").props.onChange({
      target: { value: "Ôn lại Hội nghị Ianta trong tuần này." },
    }),
  );
  await act(async () => {
    page.button("Gửi tới phụ huynh").props.onClick();
    await flush();
  });
  assert.deepEqual(page.calls[1], {
    examId: "exam",
    payload: {
      studentId: "s1",
      audience: "PARENTS",
      version: "version1",
      message: "Ôn lại Hội nghị Ianta trong tuần này.",
    },
  });
  assert.match(page.text(), /Đã gửi thông báo/);
});

test("does not offer sending to unlinked parents", async (t) => {
  const page = await render(t, {
    report: { ...report, students: [{ ...student, parentCount: 0 }] },
  });
  await page.open();
  assert.equal(page.button("Thông báo phụ huynh").props.disabled, true);
  assert.deepEqual(page.calls, ["read"]);
});

test("keeps the reviewed message when stale data rejects sending", async (t) => {
  const page = await render(t, { fail: true });
  await page.open();
  await act(async () => page.button("Nhắc học sinh").props.onClick());
  await act(async () => {
    page.button("Gửi nhắc nhở học sinh").props.onClick();
    await flush();
  });
  assert.match(page.text(), /Dữ liệu đã thay đổi/);
  assert.ok(page.renderer.root.findByType("textarea").props.value);
});

test("does not load subject data without permission", async (t) => {
  const page = await render(t, { allowed: false });
  assert.deepEqual(page.calls, []);
  assert.match(page.text(), /Bạn chưa có quyền/);
});

test("labels exam-only risk when the subject has no ready attached material", async (t) => {
  const page = await render(t, {
    report: {
      ...report,
      materialContext: { available: false, readyMaterialCount: 0 },
      riskSummary: {
        basis: "EXAM_RESULTS_ONLY",
        atRiskStudentCount: 1,
        evaluatedStudentCount: 1,
        atRiskPercentage: 100,
      },
    },
  });
  assert.match(page.text(), /Nguy cơ học lực yếu/);
  assert.match(page.text(), /100%/);
  assert.match(page.text(), /chưa tạo lộ trình học/);
});
