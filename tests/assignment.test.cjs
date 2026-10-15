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
global.window = { open: () => {} };
const flush = async () => {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
};
const text = (v) =>
  v == null
    ? ""
    : typeof v === "string" || typeof v === "number"
      ? String(v)
      : Array.isArray(v)
        ? v.map(text).join("")
        : React.isValidElement(v)
          ? text(v.props.children)
          : "";
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
const assignment = () => ({
  id: "assignment",
  lessonId: "lesson",
  termId: "term",
  title: "Homework",
  description: "",
  instructions: "Explain the answer",
  status: "DRAFT",
  maxScore: 10,
  submissionType: "TEXT_AND_FILE",
  availableFrom: null,
  dueAt: "2026-10-01T09:00:00Z",
  cutoffAt: "2026-10-01T10:00:00Z",
  allowLateSubmission: true,
  allowResubmit: true,
  maxAttempts: 3,
  createdBy: "teacher-a",
  publishedAt: null,
  revision: 0,
  audienceCount: 1,
  submissionCount: 0,
  gradedCount: 0,
});
const attempt = () => ({
  id: "attempt",
  assignmentId: "assignment",
  studentId: "student",
  attemptNumber: 1,
  submittedAt: "2026-10-01T08:00:00Z",
  isLate: false,
  status: "WAITING_FOR_GRADING",
  textContent: "My answer",
  files: [],
  maxScore: 10,
  score: null,
  feedback: "",
  returnedScore: null,
  returnedFeedback: null,
  returnedAt: null,
  revision: 0,
  assignmentSnapshot: { instructions: "Old requirement" },
});
const studentDetail = () => ({
  assignment: {
    ...assignment(),
    status: "PUBLISHED",
    publishedAt: "2026-10-01",
  },
  recipient: { assignedAt: "2026-10-01", excusedAt: null, excuseReason: "" },
  state: "NOT_SUBMITTED",
  attempts: [],
  canSubmit: true,
  historyOnly: false,
  serverNow: "2026-10-01T08:00:00Z",
  window: "ON_TIME",
});
const teacherDetail = () => ({
  assignment: assignment(),
  term: { id: "term", name: "Term", status: "ACTIVE" },
  serverNow: "2026-10-01",
  summary: {
    assigned: 1,
    onTime: 1,
    late: 0,
    notSubmitted: 0,
    excused: 0,
    returned: 0,
  },
  recipients: [
    {
      id: "recipient",
      studentId: "student",
      studentName: "Student A",
      studentAccount: "student_a",
      revision: 0,
      state: "WAITING_FOR_GRADING",
      excusedAt: null,
      latest: attempt(),
      attempts: [attempt()],
    },
  ],
});

function loader(api) {
  function load(file) {
    const filename = path.resolve(file);
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const original = mod.require.bind(mod);
    mod.require = (id) => {
      if (id === "next/link")
        return {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        };
      if (id === "@/components/ui/button")
        return {
          Button: ({ permission, children, ...props }) =>
            React.createElement("button", props, children),
        };
      if (id === "@/components/ui/modal")
        return {
          Modal: ({ open, children, footer }) =>
            open
              ? React.createElement("section", null, children, footer)
              : null,
        };
      if (id === "@/components/ui/confirmation-dialog")
        return {
          ConfirmationDialog: ({ open, children, onConfirm }) =>
            open
              ? React.createElement(
                  "section",
                  null,
                  children,
                  React.createElement(
                    "button",
                    { onClick: onConfirm },
                    "Confirm delete",
                  ),
                )
              : null,
        };
      if (id === "@/lib/assignment-api")
        return {
          assignmentService: api,
          submissionKey: async () => "persistent_submission_key_1",
          clearSubmissionKey: () => {},
        };
      if (id === "@/lib/auth-api" || id === "./auth-api")
        return {
          ApiError,
          authenticatedRequest: async () => {
            throw new Error("No live API in component tests");
          },
        };
      if (id === "@/lib/internal-results") return load("lib/internal-results.ts");
      if (id === "@/types/assignment") return load("types/assignment.ts");
      if (id === "@/components/learning/learning-exception-form") return { LearningExceptionForm: () => null };
      return original(id);
    };
    mod._compile(compiled, filename);
    return mod.exports;
  }
  return load;
}
async function render(t, name, api, props) {
  const file =
    name === "TeacherAssignmentPanel"
      ? "components/assignments/teacher-assignment-panel.tsx"
      : "components/assignments/student-assignment.tsx";
  let ui;
  await act(async () => {
    ui = create(React.createElement(loader(api)(file)[name], props));
    await flush();
  });
  t.after(async () => {
    await act(async () => ui.unmount());
  });
  return {
    ui,
    json: () => JSON.stringify(ui.toJSON()),
    button: (label) =>
      ui.root
        .findAllByType("button")
        .find((b) => text(b.props.children) === label),
    field: (label) => ui.root.findByProps({ "aria-label": label }),
  };
}
const teacherApi = (row, detail = teacherDetail()) => ({
  listTeacher: async () => ({
    assignments: row ? [row] : [],
    terms: [{ id: "term", name: "Term", status: "ACTIVE" }],
  }),
  teacherDetail: async () => detail,
  teacherAttempt: async () => ({
    attempt: detail.recipients[0].latest,
    audit: [],
  }),
});

test("teacher creates draft inside the selected lesson with separate due/cutoff policy", async (t) => {
  const calls = [];
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    { ...teacherApi(null), create: async (...args) => calls.push(args) },
    { lessonId: "lesson" },
  );
  await act(async () => ui.button("Tạo bài tập").props.onClick());
  await act(async () =>
    ui
      .field("Tên bài tập")
      .props.onChange({ target: { value: "New homework" } }),
  );
  await act(async () => {
    await ui.ui.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await flush();
  });
  assert.equal(calls[0][0], "lesson");
  assert.equal(calls[0][1].termId, "term");
  assert.equal(calls[0][1].maxScore, 10);
  assert.equal(calls[0][1].dueAt, null);
  assert.equal(calls[0][1].cutoffAt, null);
});
test("teacher preview does not publish", async (t) => {
  const row = assignment();
  let published = 0;
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    {
      ...teacherApi(row),
      preview: async () => ({ assignment: row }),
      lifecycle: async () => {
        published++;
      },
    },
    { lessonId: "lesson" },
  );
  await act(async () => {
    ui.button("Xem trước bài tập").props.onClick();
    await flush();
  });
  assert.match(ui.json(), /Explain the answer/);
  assert.equal(published, 0);
  assert.equal(row.status, "DRAFT");
});
test("teacher publishes with revision without implicitly publishing the lesson", async (t) => {
  const row = assignment();
  const calls = [];
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    {
      ...teacherApi(row),
      lifecycle: async (...args) => {
        calls.push(args);
        row.status = "PUBLISHED";
        row.revision++;
      },
    },
    { lessonId: "lesson" },
  );
  await act(async () => {
    ui.button("Tải lên").props.onClick();
    await flush();
  });
  assert.deepEqual(calls, [["assignment", "PUBLISHED", 0]]);
  assert.match(ui.json(), /Đang mở/);
});
test("teacher edits and closes an assignment with unchanged lifecycle semantics", async (t) => {
  const row = assignment(); row.status = "PUBLISHED"; row.publishedAt = "2026-10-01";
  const calls = [];
  const ui = await render(t, "TeacherAssignmentPanel", { ...teacherApi(row), lifecycle: async (...args) => {
    calls.push(args); row.status = "DRAFT"; row.revision++;
  } }, { lessonId: "lesson" });
  assert.ok(ui.button("Chỉnh sửa"));
  assert.doesNotMatch(ui.json(), /Cấu hình|Ngừng công bố bài tập|Công bố bài tập/);
  await act(async () => { ui.button("Chỉnh sửa").props.onClick(); });
  assert.equal(ui.ui.root.findAllByType("form").length, 1);
  await act(async () => { ui.button("Đóng bài tập").props.onClick(); await flush(); });
  assert.deepEqual(calls, [["assignment", "DRAFT", 0]]);
  assert.match(ui.json(), /Đã đóng/);
  assert.ok(ui.button("Tải lên"));
});

test("teacher submission filter delegates to the server and preserves summary", async (t) => {
  const calls = [];
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    {
      ...teacherApi(assignment()),
      teacherDetail: async (...args) => {
        calls.push(args);
        return teacherDetail();
      },
    },
    { lessonId: "lesson" },
  );
  await act(async () => {
    ui.button("Homework").props.onClick();
    await flush();
  });
  await act(async () => {
    ui.field("Lọc bài nộp").props.onChange({ target: { value: "LATE" } });
    await flush();
  });
  assert.deepEqual(calls.at(-1), ["assignment", "LATE"]);
});
test("teacher saves draft grade and separately returns result using current revision", async (t) => {
  const detail = teacherDetail();
  const calls = [];
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    {
      ...teacherApi(assignment(), detail),
      grade: async (...args) => {
        calls.push(["grade", ...args]);
        const saved = {
          ...attempt(),
          score: args[1],
          feedback: args[2],
          revision: 1,
          status: "GRADED_DRAFT",
        };
        detail.recipients[0].latest = saved;
        return saved;
      },
      returnGrade: async (...args) => {
        calls.push(["return", ...args]);
        const returned = {
          ...detail.recipients[0].latest,
          status: "RETURNED",
          revision: 2,
          returnedScore: 8,
          returnedFeedback: "Good",
          returnedAt: "2026-10-01",
        };
        detail.recipients[0].latest = returned;
        return returned;
      },
    },
    { lessonId: "lesson" },
  );
  await act(async () => {
    ui.button("Homework").props.onClick();
    await flush();
  });
  await act(async () => {
    ui.button("Mở / chấm bài").props.onClick();
    await flush();
  });
  await act(async () => {
    ui.field("Điểm bài nộp").props.onChange({ target: { value: "8" } });
    ui.field("Feedback bài nộp").props.onChange({ target: { value: "Good" } });
  });
  await act(async () => {
    ui.ui.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await flush();
  });
  assert.deepEqual(calls[0], ["grade", "attempt", 8, "Good", 0, ""]);
  assert.equal(calls.length, 1);
  assert.equal(ui.button("Trả kết quả").props.disabled, false);
  await act(async () => {
    ui.field("Điểm bài nộp").props.onChange({ target: { value: "9" } });
  });
  assert.equal(ui.button("Trả kết quả").props.disabled, true);
  await act(async () => {
    ui.field("Điểm bài nộp").props.onChange({ target: { value: "8" } });
  });
  assert.equal(ui.button("Trả kết quả").props.disabled, false);
  await act(async () => {
    ui.button("Trả kết quả").props.onClick();
    await flush();
  });
  assert.deepEqual(calls[1], ["return", "attempt", 1]);
});
test("teacher cannot hide failed publication behind a success label", async (t) => {
  const ui = await render(
    t,
    "TeacherAssignmentPanel",
    {
      ...teacherApi(assignment()),
      lifecycle: async () => {
        throw new Error("Term locked");
      },
    },
    { lessonId: "lesson" },
  );
  await act(async () => {
    ui.button("Tải lên").props.onClick();
    await flush();
  });
  assert.match(ui.json(), /Term locked/);
  assert.doesNotMatch(ui.json(), /Đã công bố/);
});
test("student double click produces one request and displays server late/time result", async (t) => {
  const data = studentDetail();
  const calls = [];
  const ui = await render(
    t,
    "StudentAssignmentDetail",
    {
      studentDetail: async () => data,
      submit: async (...args) => {
        calls.push(args);
        const late = { ...attempt(), isLate: true };
        data.attempts = [late];
        return late;
      },
    },
    { id: "assignment" },
  );
  await act(async () =>
    ui
      .field("Nội dung bài làm")
      .props.onChange({ target: { value: "My answer" } }),
  );
  await act(async () => {
    const submit = ui.ui.root.findByType("form").props.onSubmit;
    await Promise.all([
      submit({ preventDefault() {} }),
      submit({ preventDefault() {} }),
    ]);
    await flush();
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].idempotencyKey, "persistent_submission_key_1");
  assert.match(ui.json(), /Nộp trễ/);
});
test("student network retry keeps the same key and content", async (t) => {
  const calls = [];
  const ui = await render(
    t,
    "StudentAssignmentDetail",
    {
      studentDetail: async () => studentDetail(),
      submit: async (...args) => {
        calls.push(args);
        if (calls.length === 1) throw new Error("Network timeout");
        return attempt();
      },
    },
    { id: "assignment" },
  );
  await act(async () =>
    ui
      .field("Nội dung bài làm")
      .props.onChange({ target: { value: "Retry this" } }),
  );
  await act(async () => {
    await ui.ui.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await flush();
  });
  assert.match(ui.json(), /Network timeout/);
  await act(async () => {
    await ui.ui.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await flush();
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].idempotencyKey, calls[1][1].idempotencyKey);
  assert.equal(calls[1][1].textContent, "Retry this");
});
test("student uploads and submits file references rather than client storage keys", async (t) => {
  const calls = [];
  const ui = await render(
    t,
    "StudentAssignmentDetail",
    {
      studentDetail: async () => studentDetail(),
      upload: async () => ({
        id: "file",
        originalName: "work.pdf",
        size: 10,
        status: "READY",
      }),
      submit: async (...args) => {
        calls.push(args);
        return attempt();
      },
    },
    { id: "assignment" },
  );
  await act(async () => {
    ui.field("File bài làm").props.onChange({
      target: {
        files: [{ name: "work.pdf", size: 10, type: "application/pdf" }],
        value: "work.pdf",
      },
    });
    await flush();
  });
  await act(async () => {
    await ui.ui.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await flush();
  });
  assert.deepEqual(calls[0][1].fileIds, ["file"]);
  assert.equal(calls[0][1].sealedKey, undefined);
});
test("student sees returned zero but waiting work is not zero", async (t) => {
  const data = studentDetail();
  data.attempts = [
    {
      ...attempt(),
      status: "RETURNED",
      score: 0,
      feedback: "Zero earned",
      returnedAt: "2026-10-01",
    },
    { ...attempt(), id: "waiting", attemptNumber: 2 },
  ];
  data.canSubmit = false;
  const ui = await render(
    t,
    "StudentAssignmentDetail",
    { studentDetail: async () => data },
    { id: "assignment" },
  );
  assert.match(ui.json(), /Điểm đã trả: |Zero earned/);
  assert.match(ui.json(), /Chưa có kết quả được công bố/);
  assert.equal(ui.ui.root.findAllByType("form").length, 0);
  assert.doesNotMatch(ui.json(), /Lưu điểm nháp|Trả kết quả/);
});
test("student transfer uses authorized own history and disables new submission", async (t) => {
  const calls = [];
  const history = {
    ...studentDetail(),
    historyOnly: true,
    canSubmit: false,
    attempts: [attempt()],
  };
  const ui = await render(
    t,
    "StudentAssignmentDetail",
    {
      studentDetail: async (id, historyMode) => {
        calls.push([id, historyMode]);
        if (!historyMode) throw new ApiError("Not active", 404);
        return history;
      },
    },
    { id: "assignment" },
  );
  assert.deepEqual(calls, [
    ["assignment", undefined],
    ["assignment", true],
  ]);
  assert.match(ui.json(), /Chỉ xem lịch sử/);
  assert.equal(ui.ui.root.findAllByType("form").length, 0);
});
test("student can explicitly browse historical assignment list", async (t) => {
  const calls = [];
  const ui = await render(
    t,
    "StudentAssignmentList",
    {
      listStudent: async (...args) => {
        calls.push(args);
        return { assignments: [studentDetail()] };
      },
    },
    {},
  );
  await act(async () => {
    ui.button("Lịch sử bài tập").props.onClick();
    await flush();
  });
  assert.deepEqual(calls.at(-1), [undefined, true]);
  assert.match(ui.json(), /Homework/);
});
test("actual key helper survives refresh without retaining submission text in storage", async () => {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  const helper = loader({})("lib/assignment-api.ts");
  const first = await helper.submissionKey("assignment", "Private answer", [
    "file",
  ]);
  const refreshed = loader({})("lib/assignment-api.ts");
  assert.equal(
    await refreshed.submissionKey("assignment", "Private answer", ["file"]),
    first,
  );
  assert.doesNotMatch([...store.values()].join(""), /Private answer/);
  assert.notEqual(
    await refreshed.submissionKey("assignment", "Changed answer", ["file"]),
    first,
  );
  refreshed.clearSubmissionKey("assignment");
  assert.equal(store.size, 0);
});
