/* CommonJS loader keeps component tests isolated from the Next runtime. */
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
global.window = { setInterval, clearInterval, confirm: () => true, location: { search: "" } };
global.document = { visibilityState: "visible" };

const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const childText = (value) => typeof value === "string" || typeof value === "number" ? String(value) : Array.isArray(value) ? value.map(childText).join("") : React.isValidElement(value) ? childText(value.props.children) : "";
const capabilities = (overrides = {}) => Object.fromEntries(["processing", "materials", "knowledgeMap", "flashcards", "quiz", "mastery", "adaptiveLearning", "insights"].map((name) => [name, { enabled: overrides[name] ?? true }]));
const material = (lifecycle = "READY", overrides = {}) => ({ id: `material-${lifecycle}`, title: `${lifecycle}.pdf`, mimeType: "application/pdf", size: 2048, uploadStatus: lifecycle === "UPLOAD_PENDING" ? "PENDING" : "READY", processingStatus: lifecycle === "PROCESSING" ? "PROCESSING" : lifecycle === "FAILED" ? "FAILED" : lifecycle === "CANCELLED" ? "CANCELLED" : lifecycle === "READY" ? "COMPLETED" : "PENDING", lifecycle, version: 1, pageCount: lifecycle === "READY" ? 3 : null, readyForStudy: lifecycle === "READY", generation: null, failureCode: lifecycle === "FAILED" ? "INVALID_PDF" : lifecycle === "CANCELLED" ? "USER_CANCELLED" : null, processedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...overrides });

async function renderComponent(t, file, exportName, api, options = {}) {
  const filename = path.resolve(file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename)); const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => ({ push: options.onPush ?? (() => {}) }), useParams: () => ({ materialId: options.materialId ?? "material-ready" }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_target, name) => (props) => React.createElement("svg", { ...props, "data-icon": String(name) }) });
    if (id === "@/components/student/student-shell") return { StudentShell: ({ children }) => React.createElement("main", null, children) };
    if (id === "@/components/ui/button") return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/form-control") return { Select: ({ children, label, ...props }) => React.createElement("label", null, label, React.createElement("select", props, children)) };
    if (id === "@/components/ui/action-notification") return { useActionNotification: () => ({ notify: options.notify ?? (() => {}) }) };
    if (id === "@/lib/assessment-api") return { academicDataService: { getSubjects: async () => [{ id: "subject", name: "Biology", vietnameseName: "Sinh học", isActive: true }] } };
    if (id === "@/lib/study-coach-api") return { studyCoachService: api };
    if (id === "@/lib/study-coach-view") return {
      formatFileSize: (size) => `${size} bytes`,
      materialError: (error, fallback) => error?.safe || ({ 404: "Không tìm thấy tài liệu.", 409: "Tài liệu đang được xử lý.", 503: "Hệ thống tạm thời không khả dụng." }[error?.status]) || fallback,
      knowledgeMapError: (error) => ({ 404: "Không tìm thấy tài liệu.", 409: "Bản đồ kiến thức đang được chuẩn bị.", 503: "Không thể tải bản đồ kiến thức lúc này. Vui lòng thử lại sau." }[error?.status]) || "Lỗi bản đồ kiến thức",
      materialLifecycleLabels: { UPLOAD_PENDING: "Đang chờ tải lên", READY_TO_PROCESS: "Đã tải lên · Đang chờ xử lý", PROCESSING: "AI đang phân tích tài liệu...", READY: "Sẵn sàng học", FAILED: "Không thể xử lý tài liệu", UNAVAILABLE: "Tài liệu tạm thời không khả dụng" },
      materialLifecycleTones: { UPLOAD_PENDING: "", READY_TO_PROCESS: "", PROCESSING: "", READY: "", FAILED: "", UNAVAILABLE: "" },
      publicFailureMessage: (code) => code === "INVALID_PDF" ? "Tệp PDF không hợp lệ hoặc không thể đọc." : null,
      relationLabels: { PREREQUISITE: "là kiến thức nền cho", PART_OF: "là một phần của", RELATED_TO: "liên quan đến", CAUSES: "dẫn đến", CONTRASTS: "đối chiếu với" },
      conceptImportanceLabels: { CORE: "Kiến thức trọng tâm", SUPPORTING: "Kiến thức bổ trợ" },
    };
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  let renderer;
  await act(async () => { renderer = create(React.createElement(loaded.exports[exportName], options.props)); await flush(); });
  t.after(async () => { await act(async () => { renderer.unmount(); await flush(); }); });
  return { renderer, text: () => JSON.stringify(renderer.toJSON()), button: (label) => renderer.root.findAllByType("button").find((item) => childText(item.props.children).includes(label)) };
}

test("material library renders lifecycle allow-list states and paginates through the real service contract", async (t) => {
  const pages = [];
  const items = ["READY", "PROCESSING", "CANCELLED", "FAILED", "UNAVAILABLE", "UPLOAD_PENDING", "READY_TO_PROCESS"].map((state) => material(state));
  const api = { getMaterials: async (page) => { pages.push(page); return { items, meta: { page, limit: 6, total: 12, totalPages: 2 } }; }, processMaterial: async () => ({}) };
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", api, { props: { capabilities: capabilities() } });
  for (const expected of ["Sẵn sàng học", "AI đang phân tích tài liệu", "Không thể xử lý tài liệu", "Tài liệu tạm thời không khả dụng", "Đang chờ tải lên", "Đang chờ xử lý"]) assert.match(ui.text(), new RegExp(expected));
  assert.doesNotMatch(ui.text(), /secret-key|provider stack|retryCount/i);
  await act(async () => { ui.button("Trang sau").props.onClick(); await flush(); });
  assert.equal(pages.at(-1), 2);
});

test("material library cancels an active AI job and offers processing again", async (t) => {
  let cancelled = false;
  const calls = [];
  const api = {
    getMaterials: async () => ({
      items: [material(cancelled ? "CANCELLED" : "PROCESSING")],
      meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
    }),
    cancelMaterial: async (id) => { calls.push(id); cancelled = true; return {}; },
    processMaterial: async () => ({}),
  };
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", api, { props: { capabilities: capabilities() } });

  await act(async () => { ui.button("Hủy xử lý").props.onClick(); await flush(); });

  assert.deepEqual(calls, ["material-PROCESSING"]);
  assert.ok(ui.button("Xử lý"));
});

test("material library deletes a failed material but never offers delete for ready content", async (t) => {
  const calls = [];
  let deleted = false;
  const api = {
    getMaterials: async () => ({
      items: deleted ? [material("READY")] : [material("FAILED"), material("READY")],
      meta: { page: 1, limit: 6, total: deleted ? 1 : 2, totalPages: 1 },
    }),
    deleteMaterial: async (id) => { calls.push(id); deleted = true; return { id }; },
    processMaterial: async () => ({}),
  };
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", api, { props: { capabilities: capabilities() } });

  assert.equal(ui.renderer.root.findAllByType("button").filter((item) => childText(item.props.children).includes("Xóa")).length, 1);
  await act(async () => { ui.button("Xóa").props.onClick(); await flush(); });

  assert.deepEqual(calls, ["material-FAILED"]);
  assert.doesNotMatch(ui.text(), /FAILED\.pdf/);
  assert.match(ui.text(), /READY\.pdf/);
});

test("material library handles loading and empty without inventing local materials", async (t) => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", { getMaterials: () => pending }, { props: { capabilities: capabilities() } });
  assert.equal(ui.renderer.root.findByType("section").props["aria-busy"], true);
  await act(async () => { resolve({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } }); await flush(); });
  assert.match(ui.text(), /Bạn chưa có tài liệu học nào/);
});

test("material detail consumes readyForStudy and capability gates study navigation", async (t) => {
  const pushes = [];
  const api = { getCapabilities: async () => capabilities({ insights: false }), getMaterial: async () => material("READY", { id: "material-ready" }) };
  const ui = await renderComponent(t, "components/student/study-coach-material-detail-page.tsx", "StudyCoachMaterialDetailPage", api, { materialId: "material-ready", onPush: (href) => pushes.push(href) });
  assert.match(ui.text(), /Sẵn sàng học/);
  assert.equal(ui.button("Xem phân tích học tập"), undefined);
  await act(async () => { ui.button("Ôn thẻ ghi nhớ").props.onClick(); });
  assert.equal(pushes.at(-1), "/student/study-coach/materials/material-ready/flashcards");
  await act(async () => { ui.button("Xem tiến độ").props.onClick(); });
  assert.equal(pushes.at(-1), "/student/study-coach/materials/material-ready/mastery");
});

for (const status of [404, 409, 503]) test(`material detail presents a safe ${status} state`, async (t) => {
  const ui = await renderComponent(t, "components/student/study-coach-material-detail-page.tsx", "StudyCoachMaterialDetailPage", { getCapabilities: async () => capabilities(), getMaterial: async () => { throw { status }; } });
  assert.match(ui.text(), status === 404 ? /Không tìm thấy tài liệu/ : status === 409 ? /đang được xử lý/ : /tạm thời không khả dụng/);
});

test("knowledge map renders an accessible accordion and a natural Vietnamese relation", async (t) => {
  const api = { getCapabilities: async () => capabilities(), getKnowledgeMap: async () => ({ materialId: "material-ready", materialTitle: "cells.pdf", mapId: "map", title: "Tế bào", summary: "Cấu trúc", version: 1, status: "COMPLETED", updatedAt: "2026-01-01", topics: [{ id: "topic", stableKey: "topic", parentTopicId: null, title: "Cấu trúc tế bào", summary: "Tóm tắt", order: 1, concepts: [{ id: "a", stableKey: "a", title: "Màng", definition: "Bao bọc tế bào", importance: "CORE" }, { id: "b", stableKey: "b", title: "Vận chuyển", definition: "Trao đổi chất", importance: "SUPPORTING" }] }], relations: [{ id: "r", fromConceptId: "a", toConceptId: "b", type: "PREREQUISITE" }] }) };
  const ui = await renderComponent(t, "components/student/study-coach-knowledge-map-page.tsx", "StudyCoachKnowledgeMapPage", api);
  assert.match(ui.text(), /Màng/); assert.doesNotMatch(ui.text(), /PREREQUISITE/); assert.match(ui.text(), /Màng.*là kiến thức nền cho.*Vận chuyển/);
  assert.doesNotMatch(ui.text(), /CORE|SUPPORTING/); assert.match(ui.text(), /Kiến thức trọng tâm/);
  const topic = ui.button("Cấu trúc tế bào"); assert.equal(topic.props["aria-expanded"], true);
  await act(async () => { topic.props.onClick(); await flush(); });
  assert.doesNotMatch(ui.text(), /Bao bọc tế bào/);
});

for (const status of [404, 409, 503]) test(`knowledge map handles ${status} as a product state`, async (t) => {
  const ui = await renderComponent(t, "components/student/study-coach-knowledge-map-page.tsx", "StudyCoachKnowledgeMapPage", { getCapabilities: async () => capabilities(), getKnowledgeMap: async () => { throw { status }; } });
  assert.match(ui.text(), status === 404 ? /Không tìm thấy tài liệu/ : status === 409 ? /đang được chuẩn bị/ : /Vui lòng thử lại sau/);
});

test("knowledge map accepts a successful empty map", async (t) => {
  const ui = await renderComponent(t, "components/student/study-coach-knowledge-map-page.tsx", "StudyCoachKnowledgeMapPage", { getCapabilities: async () => capabilities(), getKnowledgeMap: async () => ({ materialId: "m", materialTitle: "empty.pdf", mapId: "map", title: "Empty", summary: "", version: 1, status: "COMPLETED", updatedAt: "", topics: [], relations: [] }) });
  assert.match(ui.text(), /chưa có cấu trúc kiến thức/);
});

test("capability contract prevents disabled material and knowledge-map requests", async (t) => {
  let materialReads = 0;
  const detail = await renderComponent(t, "components/student/study-coach-material-detail-page.tsx", "StudyCoachMaterialDetailPage", { getCapabilities: async () => capabilities({ materials: false }), getMaterial: async () => { materialReads += 1; } });
  assert.equal(materialReads, 0); assert.match(detail.text(), /không khả dụng/);
  let mapReads = 0;
  const map = await renderComponent(t, "components/student/study-coach-knowledge-map-page.tsx", "StudyCoachKnowledgeMapPage", { getCapabilities: async () => capabilities({ knowledgeMap: false }), getKnowledgeMap: async () => { mapReads += 1; } });
  assert.equal(mapReads, 0); assert.match(map.text(), /tạm thời không khả dụng/);
});

test("upload validates PDF then executes authorize, upload, confirm, process and refetch", async (t) => {
  const calls = [];
  const api = { getMaterials: async () => ({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } }), createMaterialUpload: async () => { calls.push("authorize"); return { material: { id: "m" }, uploadUrl: "signed", method: "PUT" }; }, uploadAuthorizedFile: async (_session, _file, progress) => { calls.push("upload"); progress(100); }, confirmMaterialUpload: async () => { calls.push("confirm"); }, processMaterial: async () => { calls.push("process"); } };
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", api, { props: { capabilities: capabilities() } });
  await act(async () => { ui.button("Tải tài liệu").props.onClick(); await flush(); });
  const input = ui.renderer.root.findByType("input");
  await act(async () => { input.props.onChange({ target: { files: [{ name: "notes.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 }] } }); });
  assert.match(ui.text(), /chỉ hỗ trợ tệp PDF/);
  await act(async () => { input.props.onChange({ target: { files: [{ name: "cells.pdf", type: "application/pdf", size: 1024 }] } }); ui.renderer.root.findByType("select").props.onChange({ target: { value: "subject" } }); await flush(); });
  await act(async () => { ui.button("Tải lên và xử lý").props.onClick(); await flush(); await flush(); });
  assert.deepEqual(calls, ["authorize", "upload", "confirm", "process"]);
});

for (const [name, failingMethod] of [["upload failure", "uploadAuthorizedFile"], ["confirm failure", "confirmMaterialUpload"], ["network failure", "createMaterialUpload"]]) test(`upload exposes a safe ${name}`, async (t) => {
  const api = { getMaterials: async () => ({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 0 } }), createMaterialUpload: async () => ({ material: { id: "m" }, uploadUrl: "signed", method: "PUT" }), uploadAuthorizedFile: async () => {}, confirmMaterialUpload: async () => {}, processMaterial: async () => {} };
  api[failingMethod] = async () => { throw { safe: "Không thể hoàn tất tải tài liệu." }; };
  const ui = await renderComponent(t, "components/student/study-coach-material-library.tsx", "StudyCoachMaterialLibrary", api, { props: { capabilities: capabilities() } });
  await act(async () => { ui.button("Tải tài liệu").props.onClick(); await flush(); });
  await act(async () => { ui.renderer.root.findByType("input").props.onChange({ target: { files: [{ name: "cells.pdf", type: "application/pdf", size: 1024 }] } }); ui.renderer.root.findByType("select").props.onChange({ target: { value: "subject" } }); await flush(); });
  await act(async () => { ui.button("Tải lên và xử lý").props.onClick(); await flush(); await flush(); });
  assert.match(ui.text(), /Không thể hoàn tất tải tài liệu/);
});

test("production material UI does not reference forbidden internal fields or provider credentials", () => {
  const files = ["components/student/study-coach-material-library.tsx", "components/student/study-coach-material-detail-page.tsx", "components/student/study-coach-knowledge-map-page.tsx", "lib/study-coach-api.ts"];
  const source = files.map((file) => fs.readFileSync(path.resolve(file), "utf8")).join("\n");
  for (const forbidden of ["s3Key", "correctOptionIndexes", "answerKey", "rawPrompt", "tokenUsage", "leaseUntil", "GEMINI_API_KEY"]) assert.doesNotMatch(source, new RegExp(forbidden, "i"));
});
