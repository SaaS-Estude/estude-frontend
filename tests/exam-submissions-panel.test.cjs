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
const attempt = (id, studentId, overrides = {}) => ({
  id, studentId, studentName: studentId === "a" ? "Nguyễn Văn An" : "Trần Bình",
  studentCode: studentId === "a" ? "HS001" : "HS002", status: "SUBMITTED",
  startedAt: "2026-09-20T10:00:00Z", submittedAt: "2026-09-20T10:30:00Z", score: 0, maxScore: 10, gradingStatus: "FINALIZED",
  ...overrides,
});

async function renderPanel(t, { submissions = [], allowed = true, getSubmissions } = {}) {
  const routes = [];
  let calls = 0;
  const filename = path.resolve("components/assessment/exam-submissions-panel.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => ({ push: (route) => routes.push(route) }) };
    if (id === "@/context/permissions-context") return { usePermissions: () => ({ can: () => allowed, loading: false }) };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/components/ui/button") return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/form-control") return { Input: (props) => React.createElement("input", props) };
    if (id === "@/components/ui/data-table-footer") return { DataTableFooter: () => null };
    if (id === "@/components/ui/data-table") return {
      Table: (props) => React.createElement("table", props), TableBody: (props) => React.createElement("tbody", props),
      TableCell: (props) => React.createElement("td", props), TableHead: (props) => React.createElement("th", props),
      TableHeader: (props) => React.createElement("thead", props),
      TableEmptyRow: ({ message }) => React.createElement("tr", null, React.createElement("td", null, message)),
      TableLoadingBarRow: () => React.createElement("tr", { "aria-label": "loading" }),
    };
    if (id === "@/lib/assessment-api") return { examService: { getSubmissions: async (examId) => { calls++; assert.equal(examId, "exam"); return getSubmissions ? getSubmissions() : submissions; } } };
    if (id === "@/lib/search-keyword") {
      const searchFile = path.resolve("lib/search-keyword.ts");
      const searchModule = new Module(searchFile, module);
      searchModule._compile(ts.transpileModule(fs.readFileSync(searchFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, searchFile);
      return searchModule.exports;
    }
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports.ExamSubmissionsPanel, { examId: "exam", totalPoints: 10 })); await flush(); });
  t.after(async () => { await act(async () => renderer.unmount()); });
  return { renderer, routes, calls: () => calls, text: () => JSON.stringify(renderer.toJSON()) };
}

test("lists each submitted student once, selects highest finalized score and opens that attempt", async (t) => {
  const { renderer, routes, text } = await renderPanel(t, { submissions: [
    attempt("older", "a", { score: 8 }),
    attempt("active", "a", { status: "IN_PROGRESS", submittedAt: null }),
    attempt("latest", "a", { submittedAt: "2026-09-21T10:30:00Z" }),
    attempt("pending", "b", { score: null }),
    attempt("not-submitted", "c", { studentName: "Chưa nộp", status: "IN_PROGRESS", submittedAt: null }),
  ] });
  assert.doesNotMatch(text(), /Chưa nộp/);
  assert.match(text(), /8\/10/);
  assert.match(text(), /Chưa có điểm/);
  assert.equal(renderer.root.findByType("tbody").findAllByType("tr").length, 2);
  const open = renderer.root.findAllByType("button").find((button) => button.props["aria-label"] === "Xem bài làm của Nguyễn Văn An");
  await act(async () => open.props.onClick());
  assert.deepEqual(routes, ["/teacher/exams/exam/submissions/older"]);
  const input = renderer.root.findByType("input");
  await act(async () => input.props.onChange({ target: { value: "nguyen van an" } }));
  assert.match(text(), /Nguyễn Văn An/);
  assert.doesNotMatch(text(), /Trần Bình/);
  await act(async () => input.props.onChange({ target: { value: "HS002" } }));
  assert.match(text(), /Trần Bình/);
  assert.doesNotMatch(text(), /Nguyễn Văn An/);
  await act(async () => input.props.onChange({ target: { value: "missing" } }));
  assert.match(text(), /Không tìm thấy học sinh phù hợp/);
});

test("shows an empty state when only active attempts exist", async (t) => {
  const { text } = await renderPanel(t, { submissions: [attempt("active", "a", { status: "IN_PROGRESS", submittedAt: null })] });
  assert.match(text(), /Chưa có học sinh nộp bài kiểm tra này/);
});

test("shows scores below five out of ten in red", async (t) => {
  const { renderer } = await renderPanel(t, { submissions: [
    attempt("low", "a", { score: 4 }),
    attempt("passing", "b", { score: 5 }),
  ] });
  const scoreSpans = renderer.root.findAllByType("span");
  const low = scoreSpans.find((span) => span.props.children === "4/10");
  const passing = scoreSpans.find((span) => span.props.children === "5/10");
  assert.match(low.props.className, /text-rose-600/);
  assert.match(passing.props.className, /text-brand-700/);
});

test("does not fetch submissions without permission", async (t) => {
  const { calls, text } = await renderPanel(t, { allowed: false });
  assert.equal(calls(), 0);
  assert.match(text(), /Bạn chưa có quyền xem bài nộp/);
});

test("reports a load failure and allows retry", async (t) => {
  let fail = true;
  const { renderer, calls, text } = await renderPanel(t, { getSubmissions: () => { if (fail) throw new Error("Mất kết nối"); return []; } });
  assert.match(text(), /Mất kết nối/);
  fail = false;
  await act(async () => { renderer.root.findByType("button").props.onClick(); await flush(); });
  assert.equal(calls(), 2);
  assert.match(text(), /Chưa có học sinh nộp bài kiểm tra này/);
});
