/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => new Promise(setImmediate);
const text = (r) => JSON.stringify(r.toJSON());
const content = {
  questionId: "q",
  content: "Câu hỏi tại thời điểm làm",
  type: "SINGLE_CHOICE",
  options: [{ id: "a", label: "A", text: "Phương án gốc" }],
  correctOptionIds: ["a"],
  explanation: "Giải thích gốc",
};
const item = {
  id: "e1",
  objectiveId: "o1",
  source: "ASSIGNED_EXAM",
  sourceAttemptId: "source1",
  sourceTitle: "Kiểm tra",
  observedAt: "2026-09-26",
  correctCount: 0,
  scorableCount: 1,
  accuracy: 0,
  gradingStatus: "COMPLETE",
  assistance: "NO_SYSTEM_HINTS",
  baselineEligible: true,
  objective: { title: "Phân số", granularity: "TOPIC" },
  questionSnapshot: [content],
  answers: [{ questionId: "q", selectedOptionIds: [] }],
};
const result = {
  items: [item],
  baselines: [
    { id: "baseline1", objectiveId: "o1", evidenceId: "previous", version: 3 },
  ],
  baselineHistory: [],
  missingSnapshotAttemptIds: [],
};

function load(filename, options, calls) {
  const absolute = path.resolve("components/assessment", filename);
  const loaded = new Module(absolute, module);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/image")
      return { default: (props) => React.createElement("img", props) };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/modal")
      return {
        Modal: ({ open, title, children, footer }) =>
          open
            ? React.createElement(
                "section",
                { "data-modal": true },
                title,
                children,
                footer,
              )
            : null,
      };
    if (id === "@/components/ui/form-control")
      return {
        Textarea: ({ label, ...props }) =>
          React.createElement(
            "label",
            null,
            label,
            React.createElement("textarea", props),
          ),
      };
    if (id === "@/context/permissions-context")
      return {
        usePermissions: () => ({
          can: () => options.allowed !== false,
          loading: false,
        }),
      };
    if (id === "./practice-attempt-history")
      return load("practice-attempt-history.tsx", options, calls);
    if (id === "@/lib/assessment-api")
      return {
        examService: {
          getStudentEvidence: async (...args) => {
            calls.push(["read", ...args]);
            return options.result ?? result;
          },
          selectStudentBaseline: async (...args) => {
            calls.push(["select", ...args]);
            if (options.conflict)
              throw new Error(
                "Mốc ban đầu đã thay đổi; tải lại trước khi xác nhận",
              );
            return {
              id: "baseline1",
              objectiveId: "o1",
              evidenceId: "e1",
              version: 4,
              reason: args[2].reason,
              selectedAt: "2026-09-26",
            };
          },
        },
        examAttemptService: {
          getStudyPracticeAttempt: async (...args) => {
            calls.push(["history", ...args]);
            return {
              id: "attempt1",
              attemptNumber: 1,
              assistance: "SYSTEM_HINTS_USED",
              correctCount: 0,
              totalQuestions: 1,
              questions: [
                { ...content, id: "q", selectedOptionIds: [], correct: false },
              ],
            };
          },
        },
      };
    return original(id);
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
async function render(t, options = {}) {
  const calls = [];
  const { StudentEvidencePanel } = load(
    "student-evidence-panel.tsx",
    options,
    calls,
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(StudentEvidencePanel, {
        examId: "exam",
        studentId: "student",
      }),
    );
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  const open = async () => {
    await act(async () =>
      renderer.root
        .findByProps({ "aria-label": "Xem bằng chứng source1 o1" })
        .props.onClick(),
    );
  };
  const save = () =>
    renderer.root
      .findAllByType("button")
      .find((b) => b.children.join("").includes("Xác nhận làm mốc"));
  return { renderer, calls, open, save };
}

test("teacher opens source evidence and explicitly saves reason with the pinned version", async (t) => {
  const page = await render(t);
  assert.deepEqual(page.calls, [["read", "exam", "student"]]);
  await page.open();
  assert.match(text(page.renderer), /Câu hỏi tại thời điểm làm/);
  assert.equal(page.save().props.disabled, true);
  await act(async () =>
    page.renderer.root
      .findByType("textarea")
      .props.onChange({ target: { value: "  Chọn trước hỗ trợ  " } }),
  );
  await act(async () => {
    page.save().props.onClick();
    await flush();
  });
  assert.deepEqual(page.calls[1], [
    "select",
    "exam",
    "student",
    { evidenceId: "e1", reason: "Chọn trước hỗ trợ", expectedVersion: 3 },
  ]);
  assert.match(text(page.renderer), /Đã xác nhận/);
  assert.match(
    page.renderer.root
      .findAllByType("p")
      .map((p) => p.children.join(""))
      .join(""),
    /v4/,
  );
});

test("conflicting baseline selection keeps the review and reason for retry", async (t) => {
  const page = await render(t, { conflict: true });
  await page.open();
  await act(async () =>
    page.renderer.root
      .findByType("textarea")
      .props.onChange({ target: { value: "Lý do đã viết" } }),
  );
  await act(async () => {
    page.save().props.onClick();
    await flush();
  });
  assert.match(text(page.renderer), /Mốc ban đầu đã thay đổi/);
  assert.equal(
    page.renderer.root.findByType("textarea").props.value,
    "Lý do đã viết",
  );
});

test("partial evidence is inspectable and cannot be selected as a baseline", async (t) => {
  const page = await render(t, {
    result: {
      ...result,
      items: [
        {
          ...item,
          baselineEligible: false,
          gradingStatus: "PARTIAL",
          ineligibleReason: "Bằng chứng chưa được chấm đầy đủ",
        },
      ],
    },
  });
  await page.open();
  assert.equal(page.save(), undefined);
  assert.match(text(page.renderer), /chưa được chấm đầy đủ/);
});

test("without submission permission no evidence is loaded", async (t) => {
  const page = await render(t, { allowed: false });
  assert.deepEqual(page.calls, []);
  assert.equal(page.renderer.toJSON(), null);
});

test("student views the historical attempt from its own immutable snapshot", async (t) => {
  const calls = [];
  const { PracticeAttemptHistory } = load(
    "practice-attempt-history.tsx",
    {},
    calls,
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(PracticeAttemptHistory, {
        practiceSetId: "set",
        items: [
          {
            id: "attempt1",
            attemptNumber: 1,
            status: "SUBMITTED",
            submittedAt: "2026-09-26",
            assistance: "SYSTEM_HINTS_USED",
            correctCount: 0,
            totalQuestions: 1,
            legacy: true,
          },
          {
            id: "attempt2",
            attemptNumber: 2,
            status: "READY",
            assistance: "NO_SYSTEM_HINTS",
          },
        ],
      }),
    );
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  assert.equal(
    renderer.root.findByProps({ "aria-label": "Xem lượt ôn tập 2" }).props
      .disabled,
    true,
  );
  await act(async () => {
    renderer.root
      .findByProps({ "aria-label": "Xem lượt ôn tập 1" })
      .props.onClick();
    await flush();
  });
  assert.deepEqual(calls, [["history", "set", "attempt1"]]);
  assert.match(text(renderer), /Câu hỏi tại thời điểm làm/);
  assert.match(text(renderer), /Giải thích gốc/);
  assert.match(text(renderer), /Có dùng gợi ý hệ thống/);
  assert.match(text(renderer), /các lượt từng bị ghi đè/);
});

test("student chooses between wrong-question and source-region practice", async (t) => {
  const calls = [];
  const { PracticeAttemptHistory } = load(
    "practice-attempt-history.tsx",
    {},
    [],
  );
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(PracticeAttemptHistory, {
        practiceSetId: "set",
        items: [{
          id: "attempt1",
          attemptNumber: 1,
          status: "SUBMITTED",
          assistance: "NO_SYSTEM_HINTS",
          correctCount: 1,
          totalQuestions: 3,
          practiceType: "SOURCE_REGION",
        }],
        onCreate: (practiceType) => calls.push(practiceType),
      }),
    );
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });

  const buttonWithText = (label) => renderer.root
    .findAllByType("button")
    .find((button) => button.findAll(
      (node) => typeof node.props.children === "string" && node.props.children.includes(label),
    ).length > 0);
  await act(async () => buttonWithText("Tạo bài luyện mới").props.onClick());
  assert.match(text(renderer), /Ôn lại câu sai/);
  assert.match(text(renderer), /Luyện theo vùng kiến thức/);
  await act(async () => buttonWithText("Ôn lại câu sai").props.onClick());
  assert.deepEqual(calls, ["WRONG_QUESTIONS"]);
});
