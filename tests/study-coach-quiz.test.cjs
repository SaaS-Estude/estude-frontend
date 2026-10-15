/* CommonJS is required by this isolated TypeScript component test loader. */
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

const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const deferred = () => { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const childText = (value) => typeof value === "string" || typeof value === "number" ? String(value) : Array.isArray(value) ? value.map(childText).join("") : React.isValidElement(value) ? childText(value.props.children) : "";
const quiz = { id: "exam", title: "Cell Quiz", description: "Cells", subject: { id: "subject", name: "Biology" }, document: { id: "document", name: "cells.pdf" }, availableQuestionCount: 3, activeAttemptId: null };
const questions = [
  { questionId: "q1", order: 1, type: "SINGLE_CHOICE", content: "Single question", options: [{ id: "a", label: "A", text: "Alpha" }, { id: "b", label: "B", text: "Beta" }], score: 1, maxScore: 1, conceptIds: [], sourceReferences: [], difficulty: "MEDIUM", answerState: "UNANSWERED" },
  { questionId: "q2", order: 2, type: "MULTIPLE_CHOICE", content: "Multiple question", options: [{ id: "a", label: "A", text: "One" }, { id: "b", label: "B", text: "Two" }, { id: "c", label: "C", text: "Three" }], score: 1, maxScore: 1, conceptIds: [], sourceReferences: [], difficulty: "MEDIUM", answerState: "UNANSWERED" },
  { questionId: "q3", order: 3, type: "TRUE_FALSE", content: "True false question", options: [{ id: "a", label: "A", text: "Đúng" }, { id: "b", label: "B", text: "Sai" }], score: 1, maxScore: 1, conceptIds: [], sourceReferences: [], difficulty: "EASY", answerState: "UNANSWERED" },
];
const attempt = () => ({ attemptId: "attempt", examId: "exam", status: "IN_PROGRESS", title: "Cell Quiz", documentId: "document", startedAt: new Date().toISOString(), totalQuestions: 3, answeredCount: 0, unansweredCount: 3, currentQuestionIndex: 0, questions, answers: [] });
const result = { attemptId: "attempt", examId: "exam", status: "SUBMITTED", title: "Cell Quiz", submittedAt: new Date().toISOString(), durationSeconds: 12, idempotentReplay: false, totalQuestions: 3, correctCount: 2, incorrectCount: 0, unansweredCount: 1, percentage: 66.67, score: 2, maxScore: 3, questions: questions.map((question, index) => ({ ...question, isCorrect: index < 2, selectedOptionIndexes: index < 2 ? [0] : [], score: index < 2 ? 1 : 0 })) };
const historyItem = { attemptId: "history-attempt", examId: "exam", title: "Cell Quiz", document: quiz.document, submittedAt: new Date().toISOString(), totalQuestions: 3, answeredCount: 3, correctCount: 2, incorrectCount: 1, unansweredCount: 0, percentage: 66.67, durationSeconds: 12 };

function loadStudyCoachApi(requests) {
  const filename = path.resolve("lib/study-coach-api.ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename)); const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/lib/auth-api") return { ApiError: class ApiError extends Error {}, authenticatedRequest: async (url, init) => { requests.push({ url, init }); return {}; } };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  return loaded.exports.studyCoachService;
}

async function setup(t, overrides = {}) {
  const calls = { list: [], start: [], answer: [], submit: [], get: [], export: [] };
  const storage = new Map();
  if (overrides.storedAttempt) storage.set(`estude:study-coach:quiz-attempt:v1:${overrides.materialId ?? "all"}`, overrides.storedAttempt);
  global.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  const api = {
    getQuizzes: async (documentId) => { calls.list.push(documentId); return overrides.list ? overrides.list(documentId) : { items: [quiz], total: 1 }; },
    getQuizHistory: async () => overrides.history ? overrides.history() : { items: [], total: 0 },
    getQuizExport: async (id) => { calls.export.push(id); return overrides.export ? overrides.export(id) : { examId: "exam", title: "Cell Quiz", documentId: "document", exportedAt: new Date().toISOString(), questions }; },
    getQuizAttempt: async (id) => { calls.get.push(id); return overrides.get ? overrides.get(id) : attempt(); },
    startQuiz: async (...args) => { calls.start.push(args); return overrides.start ? overrides.start(...args) : attempt(); },
    submitQuizAnswer: async (...args) => { calls.answer.push(args); return overrides.answer ? overrides.answer(...args) : { attemptId: "attempt", examId: "exam", questionId: args[1], selectedOptionIndexes: args[2], textAnswer: args[4] ?? null, answeredAt: new Date().toISOString(), responseTimeMs: 50, idempotentReplay: false, progress: { answeredCount: calls.answer.length, totalQuestions: 3 } }; },
    submitQuiz: async (...args) => { calls.submit.push(args); return overrides.submit ? overrides.submit(...args) : result; },
    getQuizResult: async () => overrides.result ? overrides.result() : result,
  };
  const filename = path.resolve("components/student/student-quiz-page.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename)); const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => ({ push() {} }), useParams: () => ({ materialId: overrides.materialId }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_target, name) => (props) => React.createElement("svg", { ...props, "data-icon": String(name) }) });
    if (id === "@/components/student/student-shell") return { StudentShell: ({ children }) => React.createElement("main", null, children) };
    if (id === "@/components/ui/button") return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/lib/study-coach-api") return { studyCoachService: api };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports.StudentQuizPage)); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); });
  const buttons = () => renderer.root.findAllByType("button");
  const button = (label) => buttons().find((item) => childText(item.props.children).includes(label));
  const text = () => JSON.stringify(renderer.toJSON());
  return { renderer, calls, button, text };
}

test("uses the available question bank, starts once on double click, and renders an answer-safe snapshot", async (t) => {
  const pending = deferred();
  const ui = await setup(t, { start: () => pending.promise });
  assert.equal(ui.button("10"), undefined); assert.equal(ui.button("20"), undefined); assert.equal(ui.button("30"), undefined);
  await act(async () => { ui.button("Cell Quiz").props.onClick(); });
  assert.match(ui.text(), /Quiz.*3.*3/);
  await act(async () => { const start = ui.button("Bắt đầu làm bài"); start.props.onClick(); start.props.onClick(); await flush(); });
  assert.equal(ui.calls.start.length, 1);
  assert.equal(ui.calls.start[0].length, 2);
  await act(async () => { pending.resolve(attempt()); await flush(); });
  assert.match(ui.text(), /Single question/);
  assert.match(ui.text(), /Lựa chọn một đáp án/);
  assert.doesNotMatch(ui.text(), /SINGLE_CHOICE/);
  assert.doesNotMatch(ui.text(), /correctOption/);
});

test("supports single, multiple and true-false interaction with progress and final result", async (t) => {
  const ui = await setup(t);
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  await act(async () => { ui.button("Alpha").props.onClick(); await flush(); });
  assert.match(ui.text(), /Multiple question/);
  assert.doesNotMatch(ui.text(), /Chính xác|Chưa chính xác/);
  await act(async () => { ui.button("One").props.onClick(); await flush(); ui.button("Three").props.onClick(); await flush(); });
  assert.match(ui.text(), /Lựa chọn nhiều đáp án/);
  await act(async () => { ui.button("Xác nhận và sang câu tiếp").props.onClick(); await flush(); });
  assert.deepEqual(ui.calls.answer[1][2], [0, 2]);
  await act(async () => { ui.button("Đúng").props.onClick(); await flush(); });
  assert.match(ui.text(), /Đúng hoặc sai/);
  await act(async () => { ui.button("Nộp bài").props.onClick(); await flush(); });
  assert.match(ui.text(), /Hoàn thành bài luyện/);
  assert.match(ui.text(), /66.67/);
  assert.match(ui.text(), /Trả lời đúng/);
  assert.match(ui.text(), /Chưa trả lời/);
  await act(async () => { ui.button("Làm lượt mới").props.onClick(); await flush(); });
  assert.ok(ui.button("Bắt đầu làm bài"));
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  assert.equal(ui.calls.start.length, 2);
});

test("supports fill-in-the-blank without revealing accepted answers before submission", async (t) => {
  const fillQuestion = { questionId: "fill", order: 1, type: "FILL_BLANK", content: "Vật chất di truyền là ___.", options: [], score: 1, maxScore: 1, conceptIds: [], sourceReferences: [], difficulty: "EASY", answerState: "UNANSWERED" };
  const fillAttempt = { attemptId: "fill-attempt", examId: "exam", status: "IN_PROGRESS", title: "Cell Quiz", documentId: "document", startedAt: new Date().toISOString(), totalQuestions: 1, answeredCount: 0, unansweredCount: 1, currentQuestionIndex: 0, questions: [fillQuestion], answers: [] };
  const ui = await setup(t, {
    start: () => fillAttempt,
    answer: (_attemptId, questionId, selectedOptionIndexes, _eventId, textAnswer) => ({ attemptId: "fill-attempt", examId: "exam", questionId, selectedOptionIndexes, textAnswer, answeredAt: new Date().toISOString(), responseTimeMs: 50, idempotentReplay: false, progress: { answeredCount: 1, totalQuestions: 1 } }),
  });
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  assert.match(ui.text(), /Điền vào chỗ trống/);
  assert.doesNotMatch(ui.text(), /ADN|DNA|correctAnswers/);
  const input = ui.renderer.root.findByType("input");
  await act(async () => { input.props.onChange({ target: { value: "ADN" } }); await flush(); });
  await act(async () => { ui.button("Xác nhận câu trả lời").props.onClick(); await flush(); });
  assert.deepEqual(ui.calls.answer[0][2], []);
  assert.equal(ui.calls.answer[0][4], "ADN");
});

test("sends only the field required by each answer type", async () => {
  const requests = [];
  const api = loadStudyCoachApi(requests);

  await api.submitQuizAnswer("attempt", "fill", [], "fill-event", "doc lap");
  await api.submitQuizAnswer("attempt", "choice", [1], "choice-event");

  assert.deepEqual(JSON.parse(requests[0].init.body), { questionId: "fill", textAnswer: "doc lap", clientEventId: "fill-event" });
  assert.deepEqual(JSON.parse(requests[1].init.body), { questionId: "choice", selectedOptionIndexes: [1], clientEventId: "choice-event" });
});

test("exports an answer-safe printable question sheet", async (t) => {
  const writes = [];
  const previousWindow = global.window;
  global.window = { location: { search: "" }, open: () => ({ document: { write: (value) => writes.push(value), open() {}, close() {} }, focus() {}, close() {} }) };
  t.after(() => { global.window = previousWindow; });
  const ui = await setup(t);
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Xuất câu hỏi PDF").props.onClick(); await flush(); });
  assert.deepEqual(ui.calls.export, ["exam"]);
  assert.match(writes.join(""), /Cell Quiz/);
  assert.match(writes.join(""), /Single question/);
  assert.doesNotMatch(writes.join(""), /correctOption|correctAnswers/);
});

test("retries a failed answer with the same clientEventId and prevents double submit", async (t) => {
  let count = 0;
  const pending = deferred();
  const ui = await setup(t, { answer: () => { if (count++ === 0) throw new Error("Network lost"); return pending.promise; } });
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  await act(async () => { ui.button("Alpha").props.onClick(); await flush(); });
  assert.match(ui.text(), /Network lost/);
  await act(async () => { const retry = ui.button("Gửi lại câu trả lời"); retry.props.onClick(); retry.props.onClick(); await flush(); });
  assert.equal(ui.calls.answer.length, 2);
  assert.equal(ui.calls.answer[0][3], ui.calls.answer[1][3]);
  pending.resolve({ attemptId: "attempt", examId: "exam", questionId: "q1", selectedOptionIndexes: [0], answeredAt: new Date().toISOString(), responseTimeMs: 50, idempotentReplay: true, progress: { answeredCount: 1, totalQuestions: 3 } });
  await act(async () => { await flush(); });
});

test("always opens the quiz hub instead of restoring an old result and handles an empty question bank", async (t) => {
  const resumed = await setup(t, { storedAttempt: "attempt" });
  assert.deepEqual(resumed.calls.get, []);
  assert.match(resumed.text(), /Làm bài mới/);
  assert.match(resumed.text(), /Lịch sử làm bài/);
  const empty = await setup(t, { list: () => ({ items: [], total: 0 }) });
  assert.equal(empty.renderer.root.findByProps({ "data-testid": "quiz-hub" }) != null, true);
});

test("retries final submission with one stable event ID and blocks double click", async (t) => {
  let count = 0;
  const pending = deferred();
  const ui = await setup(t, { submit: () => { if (count++ === 0) throw new Error("Submit timeout"); return pending.promise; } });
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bỏ qua / Câu tiếp").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bỏ qua / Câu tiếp").props.onClick(); await flush(); });
  await act(async () => { ui.button("Nộp bài").props.onClick(); await flush(); });
  assert.match(ui.text(), /Submit timeout/);
  await act(async () => { const retry = ui.button("Thử nộp lại"); retry.props.onClick(); retry.props.onClick(); await flush(); });
  assert.equal(ui.calls.submit.length, 2);
  assert.equal(ui.calls.submit[0][1], ui.calls.submit[1][1]);
  pending.resolve(result);
  await act(async () => { await flush(); });
});

test("keeps quiz content in the selected material and lets students mark questions to revisit", async (t) => {
  const ui = await setup(t, { materialId: "document" });
  assert.deepEqual(ui.calls.list, ["document"]);
  await act(async () => { ui.button("Cell Quiz").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bắt đầu làm bài").props.onClick(); await flush(); });
  await act(async () => { ui.button("Bỏ qua \/ Câu tiếp").props.onClick(); await flush(); });
  await act(async () => { ui.button("One").props.onClick(); await flush(); });
  await act(async () => { ui.button("Đánh dấu câu này").props.onClick(); await flush(); });
  assert.match(ui.text(), /Đã đánh dấu/);
  await act(async () => { ui.button("Bỏ qua \/ Câu tiếp").props.onClick(); await flush(); });
  const secondQuestion = ui.renderer.root.findAllByType("button").find((item) => item.props["aria-label"]?.startsWith("Câu 2,"));
  await act(async () => { secondQuestion.props.onClick(); await flush(); });
  assert.match(ui.text(), /Multiple question/);
  assert.equal(ui.button("One").props["aria-pressed"], true);
});

test("shows completed attempts in history and opens a result only on request", async (t) => {
  const ui = await setup(t, { history: () => ({ items: [historyItem], total: 1 }) });
  assert.match(ui.text(), /Các lượt đã hoàn thành/);
  assert.match(ui.text(), /66\.67.*%/s);
  assert.doesNotMatch(ui.text(), /Hoàn thành bài luyện/);
  await act(async () => { ui.button("Xem kết quả").props.onClick(); await flush(); });
  assert.match(ui.text(), /Hoàn thành bài luyện/);
  await act(async () => { ui.button("Trang bài luyện").props.onClick(); await flush(); });
  assert.match(ui.text(), /Làm bài mới/);
});
