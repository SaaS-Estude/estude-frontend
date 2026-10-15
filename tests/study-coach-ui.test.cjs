/* CommonJS is required by the repository's isolated TypeScript component test loader. */
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
const childText = (value) => typeof value === "string" || typeof value === "number" ? String(value) : Array.isArray(value) ? value.map(childText).join("") : React.isValidElement(value) ? childText(value.props.children) : "";
const insight = (source = "AI", scope = "STUDENT") => ({ id: "insight", scope, documentId: scope === "DOCUMENT" ? "doc" : null, language: "vi", status: source === "FALLBACK" ? "FAILED" : "COMPLETED", source, isFresh: true, generatedAt: new Date().toISOString(), errorCode: source === "FALLBACK" ? "AI_TIMEOUT" : null, providerFailureRetryable: false, canRegenerateSameInput: false, summary: "Bạn nên tiếp tục củng cố khái niệm tế bào.", strengths: [], weakAreas: [{ conceptId: "concept", conceptName: "Tế bào", topicId: "topic", documentId: "doc", masteryScore: 0.4, evidenceCount: 3, correctEvidence: 1, incorrectEvidence: 2, state: "NEEDS_SUPPORT", targetDifficulty: "EASY", updatedAt: new Date().toISOString(), reason: "Khái niệm này cần thêm luyện tập." }], progress: [], nextActions: [{ conceptId: "concept", conceptName: "Tế bào", topicId: "topic", documentId: "doc", masteryScore: 0.4, evidenceCount: 3, correctEvidence: 1, incorrectEvidence: 2, state: "NEEDS_SUPPORT", targetDifficulty: "EASY", updatedAt: new Date().toISOString(), actionType: "PRACTICE", reason: "Luyện tập phù hợp với trạng thái hiện tại.", priority: 1 }], mastery: [], quiz: { answeredCount: 3, correctCount: 1, incorrectCount: 2, accuracy: 1 / 3 }, flashcards: { reviewCount: 2 }, window: {} });

const capabilities = (insights = true) => Object.fromEntries(["processing", "materials", "knowledgeMap", "flashcards", "quiz", "mastery", "adaptiveLearning", "insights"].map((name) => [name, { enabled: name === "insights" ? insights : true }]));
const materialPage = () => ({ items: [{ id: "doc", title: "cells.pdf", readyForStudy: true }], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
const insightProgress = (hasData = true) => ({ items: [{ conceptId: "concept", conceptName: "Tế bào", topicId: "topic", documentId: "doc", masteryScore: hasData ? 0.4 : 0.5, evidenceCount: hasData ? 3 : 0, correctEvidence: hasData ? 1 : 0, incorrectEvidence: hasData ? 2 : 0, state: hasData ? "NEEDS_SUPPORT" : "NEW", targetDifficulty: "EASY", updatedAt: new Date().toISOString() }], total: 1, activity: { flashcardReviewCount: hasData ? 2 : 0, quizAnswerCount: hasData ? 3 : 0, totalActivityCount: hasData ? 5 : 0 }, policy: { minimumEvidenceRequired: 3 } });

test("exam review combines required and optional review into one table", () => {
  const source = fs.readFileSync(path.resolve("components/student/student-review-page.tsx"), "utf8");
  assert.match(source, /Danh sách bài kiểm tra để ôn tập/);
  assert.match(source, /Loại ôn tập/);
  assert.match(source, /Tự chọn ôn thêm/);
  assert.equal((source.match(/<Table className=/g) ?? []).length, 1);
  assert.doesNotMatch(source, /<h2[^>]*>Tự chọn ôn thêm với AI<\/h2>/);
  assert.doesNotMatch(source, /Danh sách bài luyện|openPracticeHistory/);
  assert.doesNotMatch(source, /Ôn lý thuyết/);
  assert.match(source, /study\?tab=practice/);
});

test("practice history lives inside the practice tab and opens dedicated pages", () => {
  const source = fs.readFileSync(path.resolve("components/assessment/study-analysis-page.tsx"), "utf8");
  assert.match(source, /activeTab === "practice"/);
  assert.match(source, /<PracticeAttemptHistory/);
  assert.doesNotMatch(source, /router\.replace\(`\/student\/study-coach\/practice/);
  assert.match(source, /study\?tab=\$\{tab\}/);
  assert.match(source, /study-coach\/practice\/\$\{params\.id\}/);
  assert.match(source, /study-coach\/practice-results\/\$\{attempt\.id\}/);
  const workspace = fs.readFileSync(path.resolve("components/student/exam-practice-workspace.tsx"), "utf8");
  const page = fs.readFileSync(path.resolve("components/student/student-exam-practice-page.tsx"), "utf8");
  assert.match(workspace, /Quay lại danh sách bài luyện/);
  assert.match(page, /attempts\/\$\{attemptId\}\/study\?tab=practice/);
});

test("student study progress shows the AI evaluation after self-study", () => {
  const source = fs.readFileSync(path.resolve("components/assessment/study-activity-dashboard.tsx"), "utf8");
  assert.match(source, /Đánh giá sau quá trình tự ôn/);
  assert.match(source, /dashboard\.activityReview\.comment/);
  assert.match(source, /studyActivityReviewSections/);
});

async function renderComponent(t, file, exportName, api, options = {}) {
  const previousWindow = global.window;
  const location = {
    search: options.search ?? "",
    hash: options.hash ?? "",
    href: `http://localhost/student/study-coach${options.search ?? ""}${options.hash ?? ""}`,
  };
  global.window = {
    location,
    history: {
      replaceState(_state, _title, value) {
        const next = new URL(value, "http://localhost");
        location.search = next.search;
        location.hash = next.hash;
        location.href = next.href;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) { callback(); },
  };
  const filename = path.resolve(file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename)); const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => ({ push() {} }), useParams: () => ({ materialId: options.materialId }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_target, name) => (props) => React.createElement("svg", { ...props, "data-icon": String(name) }) });
    if (id === "@/components/student/student-shell") return { StudentShell: ({ children }) => React.createElement("main", null, children) };
    if (id === "@/components/student/student-review-page") return { StudentExamReviewPanel: () => React.createElement("section", { "data-testid": "exam-review-panel" }, "Ôn tập bài kiểm tra") };
    if (id === "@/components/student/study-coach-material-library") return { StudyCoachMaterialLibrary: () => React.createElement("section", { "data-testid": "material-library" }) };
    if (id === "@/components/ui/button") return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/form-control") return { Select: ({ children, label, ...props }) => React.createElement("label", null, label, React.createElement("select", props, children)) };
    if (id === "@/lib/study-coach-api") return { studyCoachService: api };
    if (id === "@/lib/study-coach-view") return { difficultyLabels: { EASY: "Dễ", MEDIUM: "Trung bình", HARD: "Thử thách" }, masteryLabels: { NEW: "Chưa đủ dữ liệu", NEEDS_SUPPORT: "Cần ôn lại", DEVELOPING: "Đang tiến bộ", PROFICIENT: "Nắm vững", STRONG: "Nắm rất vững" }, masteryTones: { NEW: "", NEEDS_SUPPORT: "", DEVELOPING: "", PROFICIENT: "", STRONG: "" }, actionLabels: { LEARN: "Xem lại kiến thức", PRACTICE: "Làm bài luyện", REVIEW: "Ôn thẻ ghi nhớ", CHALLENGE: "Làm bài nâng cao" }, actionHref: () => "/next", isInsightDisabled: (error) => error?.disabled === true, studentError: (error, fallback) => error?.message || fallback };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports[exportName])); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); global.window = previousWindow; });
  const text = () => JSON.stringify(renderer.toJSON());
  const button = (label) => renderer.root.findAllByType("button").find((item) => childText(item.props.children).includes(label));
  return { renderer, text, button };
}

test("mastery explains evidence, shows filter counts and filters locally", async (t) => {
  const calls = [];
  const item = { conceptId: "concept", conceptName: "Tế bào", topicId: "topic", documentId: "doc", masteryScore: 0.4, evidenceCount: 3, correctEvidence: 1, incorrectEvidence: 2, state: "NEEDS_SUPPORT", targetDifficulty: "EASY", updatedAt: new Date().toISOString() };
  const ui = await renderComponent(t, "components/student/study-coach-mastery-page.tsx", "StudyCoachMasteryPage", { getMastery: async (query) => { calls.push(query); return { items: calls.length === 1 ? [item] : [], total: calls.length === 1 ? 1 : 0, activity: { flashcardReviewCount: 12, quizAnswerCount: 3, flashcardSessionCount: 2, quizCompletionCount: 1, totalCompletedSessions: 3, totalActivityCount: 3 } }; }, getMaterial: async () => ({ id: "doc", title: "cells.pdf" }) }, { materialId: "doc" });
  assert.match(ui.text(), /Tế bào/); assert.match(ui.text(), /Cần ôn lại/); assert.match(ui.text(), /Ôn lại kiến thức nền/); assert.match(ui.text(), /Cách đọc gợi ý luyện tiếp/); assert.match(ui.text(), /Kết quả bài luyện/); assert.match(ui.text(), /Gợi ý luyện tiếp/); assert.match(ui.text(), /Lượt ôn thẻ/); assert.match(ui.text(), /Lượt làm bài/); assert.match(ui.text(), /1 đúng · 2 sai/); assert.match(ui.text(), /40%/); assert.doesNotMatch(ui.text(), /Mức bài phù hợp tiếp theo/);
  await act(async () => { ui.button("Nắm rất vững").props.onClick(); await flush(); });
  assert.deepEqual(calls, [{ documentId: "doc" }]); assert.match(ui.text(), /Chưa có khái niệm ở mức/); assert.match(ui.text(), /Tiếp tục làm bài luyện/);
});

test("mastery gives neutral next steps before there is enough evidence", async (t) => {
  const item = { conceptId: "concept", conceptName: "Nguyên phân", topicId: "topic", documentId: "doc", masteryScore: 0.5, evidenceCount: 0, correctEvidence: 0, incorrectEvidence: 0, state: "NEW", targetDifficulty: "EASY", updatedAt: new Date().toISOString() };
  const ui = await renderComponent(t, "components/student/study-coach-mastery-page.tsx", "StudyCoachMasteryPage", {
    getMastery: async () => ({ items: [item], total: 1, activity: { flashcardReviewCount: 0, quizAnswerCount: 0, flashcardSessionCount: 0, quizCompletionCount: 0, totalCompletedSessions: 0, totalActivityCount: 0 }, policy: { minimumEvidenceRequired: 3 } }),
    getMaterial: async () => ({ id: "doc", title: "Sinh học.pdf" }),
  }, { materialId: "doc" });
  assert.match(ui.text(), /Chưa bắt đầu/);
  assert.match(ui.text(), /Bắt đầu từ kiến thức nền/);
  assert.match(ui.text(), /Làm câu hỏi cơ bản để có kết quả đánh giá đầu tiên/);
  assert.doesNotMatch(ui.text(), /Ôn lại kiến thức nền/);
});

test("Study Coach groups mastery by material instead of mixing concepts", async (t) => {
  const first = { conceptId: "c1", conceptName: "Khái niệm A", topicId: "t1", documentId: "doc-a", masteryScore: 0.4, evidenceCount: 3, correctEvidence: 1, incorrectEvidence: 2, state: "NEEDS_SUPPORT", targetDifficulty: "EASY", updatedAt: new Date().toISOString() };
  const second = { ...first, conceptId: "c2", conceptName: "Khái niệm B", documentId: "doc-b", masteryScore: 0.9, correctEvidence: 3, incorrectEvidence: 0, state: "STRONG", targetDifficulty: "HARD" };
  const api = {
    getCapabilities: async () => capabilities(),
    getMastery: async () => ({ items: [first, second], total: 2, activity: { flashcardReviewCount: 0, quizAnswerCount: 6, totalActivityCount: 6 } }),
    getMaterials: async () => ({ items: [{ id: "doc-a", title: "Sinh học.pdf", readyForStudy: true }, { id: "doc-b", title: "Tin học.pdf", readyForStudy: true }], meta: { page: 1, limit: 100, total: 2, totalPages: 1 } }),
    getInsights: async () => ({ items: [], total: 0 }),
    getDueQueue: async () => ({ dueCount: 0, newCount: 0 }),
  };
  const ui = await renderComponent(t, "components/student/study-coach-home-page.tsx", "StudyCoachHomePage", api);
  assert.match(ui.text(), /Năng lực theo từng tài liệu/);
  assert.match(ui.text(), /Sinh học\.pdf/);
  assert.match(ui.text(), /Tin học\.pdf/);
  assert.match(ui.text(), /Học tiếp từ đúng nơi bạn cần/);
  assert.doesNotMatch(ui.text(), /Năng lực theo khái niệm/);
  assert.ok(ui.button("Tự học"));
  assert.ok(ui.button("Ôn tập bài kiểm tra"));
  assert.doesNotMatch(ui.text(), /exam-review-panel/);
  await act(async () => { ui.button("Ôn tập bài kiểm tra").props.onClick(); await flush(); });
  assert.match(ui.text(), /exam-review-panel/);
  assert.doesNotMatch(ui.text(), /Học tiếp từ đúng nơi bạn cần/);
  assert.doesNotMatch(ui.text(), /Năng lực theo từng tài liệu/);
});

test("insights render safe ready/fallback states, preserve action order and prevent duplicate generation", async (t) => {
  let current = null; let posts = 0; let resolvePost;
  const pending = new Promise((resolve) => { resolvePost = resolve; });
  const api = { getCapabilities: async () => capabilities(), getMaterials: async () => materialPage(), getMastery: async () => insightProgress(), getInsights: async () => ({ items: current ? [current] : [], total: current ? 1 : 0 }), generateInsight: async () => { posts += 1; return pending; } };
  const ui = await renderComponent(t, "components/student/study-coach-insights-page.tsx", "StudyCoachInsightsPage", api);
  const generate = ui.button("Tạo phân tích");
  await act(async () => { generate.props.onClick(); generate.props.onClick(); await flush(); });
  assert.equal(posts, 1); assert.match(ui.text(), /Đang tạo/);
  await act(async () => { resolvePost(insight("FALLBACK")); await flush(); });
  assert.match(ui.text(), /nhận định tạm thời/i); assert.match(ui.text(), /Làm bài luyện/); assert.match(ui.text(), /Tế bào/); assert.match(ui.text(), /Nên ưu tiên ôn lại/); assert.doesNotMatch(ui.text(), /Ngôn ngữ phân tích|English/);
});

test("insights distinguish document scope and treat the backend disabled flag as product state", async (t) => {
  const calls = []; let posts = 0;
  const api = {
    getCapabilities: async () => capabilities(),
    getMaterials: async () => materialPage(),
    getMastery: async () => insightProgress(),
    getInsights: async (...args) => { calls.push(args); return { items: [], total: 0 }; },
    generateInsight: async () => { posts += 1; throw { disabled: true, message: "Learning insight generation is not enabled" }; },
  };
  const ui = await renderComponent(t, "components/student/study-coach-insights-page.tsx", "StudyCoachInsightsPage", api);
  const scopeSelect = ui.renderer.root.findAllByType("select")[0];
  await act(async () => { scopeSelect.props.onChange({ target: { value: "DOCUMENT" } }); await flush(); });
  assert.equal(calls.at(-1)[0].scope, "DOCUMENT"); assert.equal(calls.at(-1)[0].documentId, "doc");
  await act(async () => { ui.button("Tạo phân tích").props.onClick(); await flush(); });
  assert.equal(posts, 1); assert.match(ui.text(), /Phân tích học tập đang tạm ngừng/); assert.doesNotMatch(ui.text(), /AI failed/i);
});

test("insights with no evidence show objective guidance instead of strengths or weaknesses", async (t) => {
  const emptyInsight = { ...insight("INSUFFICIENT_DATA", "DOCUMENT"), summary: "Chưa đủ dữ liệu", strengths: [], weakAreas: [], progress: [], nextActions: [], mastery: insightProgress(false).items, quiz: { attemptCount: 0, completedAttempts: 0, questionCount: 0, score: 0, answeredCount: 0, correctCount: 0, incorrectCount: 0, accuracy: null, meanResponseTimeMs: null }, flashcards: { reviewCount: 0, againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 } };
  const api = { getCapabilities: async () => capabilities(), getMaterials: async () => materialPage(), getMastery: async () => insightProgress(false), getInsights: async () => ({ items: [emptyInsight], total: 1 }) };
  const ui = await renderComponent(t, "components/student/study-coach-insights-page.tsx", "StudyCoachInsightsPage", api, { search: "?documentId=doc" });
  assert.match(ui.text(), /Chưa đủ kết quả để đánh giá khách quan/);
  assert.match(ui.text(), /Mỗi khái niệm cần ít nhất 3 lượt đánh giá/);
  assert.ok(ui.button("Làm bài luyện"));
  assert.ok(ui.button("Ôn thẻ ghi nhớ"));
  assert.doesNotMatch(ui.text(), /Điểm mạnh|Cần củng cố/);
});

test("Study Coach production UI does not reference forbidden learning internals or direct AI providers", () => {
  const files = ["components/student/study-coach-home-page.tsx", "components/student/study-coach-mastery-page.tsx", "components/student/study-coach-insights-page.tsx", "lib/study-coach-api.ts"];
  const source = files.map((file) => fs.readFileSync(path.resolve(file), "utf8")).join("\n");
  for (const forbidden of ["correctOptionIndexes", "answerKey", "alpha", "beta", "Gemini", "GEMINI_API_KEY", "studentId"]) assert.doesNotMatch(source, new RegExp(forbidden, "i"));
  for (const selector of ["study-coach-home", "mastery-overview", "mastery-concept", "insight-summary", "insight-next-action", "insight-generate"]) assert.match(source, new RegExp(selector));
});

test("student Study Coach routes reuse the student study permission", () => {
  const filename = path.resolve("lib/permissions.ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);

  assert.equal(loaded.exports.routePermission("/student/study-coach"), "study.read");
  assert.equal(
    loaded.exports.routePermission("/student/study-coach/materials/document-1"),
    "study.read",
  );
  assert.equal(loaded.exports.routePermission("/student/review/flashcards"), "study.read");
});

test("document-scoped learning pages preserve the selected material context", () => {
  const files = [
    "components/student/student-flashcards-page.tsx",
    "components/student/student-quiz-page.tsx",
    "components/student/study-coach-mastery-page.tsx",
    "components/student/study-coach-insights-page.tsx",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    assert.match(source, /student\/study-coach\/materials/);
    assert.match(source, /Quay lại tài liệu/);
  }
});
