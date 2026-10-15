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
const textOf = (node) =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : textOf(node?.children ?? []);

function passthrough(tag = "div") {
  function Passthrough({ children, ...props }) {
    return React.createElement(tag, props, children);
  }
  return Passthrough;
}

function loadPage(getAttempt) {
  const mounts = { analysis: 0, evidence: 0 };
  const filename = path.resolve("components/assessment/submissions-page.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation")
      return {
        useParams: () => ({ id: "exam-1", attemptId: "attempt-1" }),
        useRouter: () => ({ push: () => undefined }),
      };
    if (id === "lucide-react")
      return new Proxy({}, { get: () => passthrough("svg") });
    if (id === "@/components/assessment/assessment-shell")
      return {
        AssessmentShell: passthrough("main"),
        ErrorPanel: ({ message }) => React.createElement("p", null, message),
        LoadingPanel: () => React.createElement("p", null, "loading"),
        PageHeading: ({ title, description }) =>
          React.createElement("header", null, title, description),
      };
    if (id === "@/components/assessment/student-intervention-panel")
      return {
        StudentInterventionPanel: function StudentInterventionPanel() {
          React.useEffect(() => {
            mounts.analysis += 1;
          }, []);
          return React.createElement("div", null, "student-ai-analysis");
        },
      };
    if (id === "@/components/assessment/study-evidence-panel")
      return {
        StudyEvidencePanel: function StudyEvidencePanel() {
          React.useEffect(() => {
            mounts.evidence += 1;
          }, []);
          return React.createElement("div", null, "student-study-evidence");
        },
      };
    if (id === "@/components/ui/action-notification")
      return { useActionNotification: () => ({ notify: () => undefined }) };
    if (id === "@/components/ui/button")
      return { Button: passthrough("button") };
    if (id === "@/components/ui/data-table")
      return new Proxy({}, { get: () => passthrough("div") });
    if (id === "@/components/ui/form-control")
      return { Textarea: passthrough("textarea") };
    if (id === "@/components/ui/modal") return { Modal: passthrough() };
    if (id === "@/lib/search-keyword")
      return {
        matchesSearchKeyword: () => true,
        normalizeSearchKeyword: () => "",
      };
    if (id === "@/lib/assessment-api")
      return {
        examService: {},
        examAttemptService: { getAttempt },
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
  return { Page: loaded.exports.SubmissionDetailPage, mounts };
}

function attempt(score) {
  return {
    id: "attempt-1",
    examId: "exam-1",
    studentId: "student-1",
    studentName: "Nguyễn Văn An",
    status: "SUBMITTED",
    startedAt: "2026-09-29T12:00:00+07:00",
    expiresAt: null,
    submittedAt: "2026-09-29T12:34:56+07:00",
    answers: [],
    score,
    correctCount: score / 2,
    durationSeconds: 2096,
    examCode: "A01",
    exam: {
      id: "exam-1",
      title: "Bài kiểm tra lịch sử",
      totalPoints: 10,
      classId: "class-1",
      subjectId: "subject-1",
      questions: [],
    },
  };
}

async function renderDetail(t, score) {
  const { Page, mounts } = loadPage(async () => attempt(score));
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Page));
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return { renderer, mounts };
}

test("below-average submission can open AI analysis from the second tab", async (t) => {
  const { renderer, mounts } = await renderDetail(t, 4);
  const tabs = renderer.root
    .findAllByType("button")
    .filter((button) => button.props.role === "tab");
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].props["aria-selected"], true);
  assert.equal(tabs[1].props.disabled, false);
  assert.match(textOf(renderer.toJSON()), /Ngày nộp/);
  assert.match(textOf(renderer.toJSON()), /Giờ nộp/);
  assert.deepEqual(mounts, { analysis: 0, evidence: 0 });

  await act(async () => tabs[1].props.onClick());
  const shown = textOf(renderer.toJSON());
  assert.match(shown, /student-ai-analysis/);
  assert.doesNotMatch(shown, /student-study-evidence/);
  assert.deepEqual(mounts, { analysis: 1, evidence: 0 });

  const currentTabs = renderer.root
    .findAllByType("button")
    .filter((button) => button.props.role === "tab");
  await act(async () => currentTabs[0].props.onClick());
  await act(async () => currentTabs[1].props.onClick());
  assert.deepEqual(mounts, { analysis: 1, evidence: 0 });
});

test("average submission can open its personal AI analysis", async (t) => {
  const { renderer } = await renderDetail(t, 5);
  const tabs = renderer.root
    .findAllByType("button")
    .filter((button) => button.props.role === "tab");
  assert.equal(tabs[1].props.disabled, false);
  assert.equal(tabs[1].props["aria-disabled"], false);
  await act(async () => tabs[1].props.onClick());
  assert.match(textOf(renderer.toJSON()), /student-ai-analysis/);
});
