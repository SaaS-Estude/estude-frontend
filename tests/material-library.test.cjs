require("./helpers/register-ui.cjs");
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
const material = { id: "file", originalName: "lich-su.pdf", mimeType: "application/pdf", size: 100, createdAt: "2026-10-01", assignments: [] };
const subject = { id: "history", code: "HIS", name: "Lịch sử" };
const schoolClass = { id: "class", name: "12A2", code: "LH001", subjects: [subject] };
const courses = ["hk1", "hk2"].map((id) => ({ id, primaryClassId: "class", subjectId: "history", status: "DRAFT", sectionKey: "MAIN", term: { name: id === "hk1" ? "Học kỳ 1" : "Học kỳ 2" } }));
async function setup(t, overrides = {}) {
  const reads = [], writes = [];
  const filename = path.resolve("components/teacher/material-library-panel.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/context/permissions-context") return { usePermissions: () => ({ can: () => true }) };
    if (id === "@/components/ui/action-notification") return { useActionNotification: () => ({ notify() {} }) };
    if (id === "@/lib/assessment-api") return { academicDataService: {
      getMaterialLibrary: async () => { reads.push("library"); return [material]; },
      getTeacherAssignedClasses: async () => { reads.push("classes"); return [schoolClass]; },
      getClassTopics: async (id, courseId) => {
        reads.push([id, courseId]);
        if (overrides.topicError) throw new Error("Không tải được chủ đề");
        return [{ id: `topic-${courseId}`, subjectId: "history", name: `Chủ đề ${courseId}`, lessons: [{ id: `lesson-${courseId}`, title: "Bài học" }] }];
      },
      bulkAssignMaterials: async (ids, targets) => { writes.push({ ids, targets }); return { assignedCount: targets.length }; },
    } };
    if (id === "@/lib/course-offering-api") return { courseOfferingApi: { list: async () => courses } };
    if (id === "@/lib/subject-localization") return { getVietnameseSubjectName: (value) => value.name };
    if (id === "@/components/ui/button") return { Button: ({ children, permission, ...props }) => { void permission; return React.createElement("button", props, children); } };
    if (id === "@/components/ui/modal") return { Modal: ({ open, children, footer }) => open ? React.createElement("section", { "data-modal": true }, children, footer) : null };
    if (id === "@/components/ui/confirmation-dialog") return { ConfirmationDialog: () => null };
    if (id === "@/components/ui/debounced-search-input") return { DebouncedSearchInput: () => null };
    if (id === "@/components/ui/data-table-footer") return { DataTableFooter: () => null };
    if (id === "@/components/ui/form-control") return {
      FileInput: () => null,
      Checkbox: (props) => React.createElement("input", { ...props, type: "checkbox" }),
      Select: ({ children, ...props }) => React.createElement("select", props, children),
      Input: (props) => React.createElement("input", props),
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  let ui;
  await act(async () => { ui = create(React.createElement(loaded.exports.TeacherMaterialLibraryPanel)); await flush(); });
  t.after(async () => { await act(async () => ui.unmount()); });
  const json = () => JSON.stringify(ui.toJSON());
  const button = (label) => ui.root.findAllByType("button").find((node) => node.children.filter((child) => typeof child === "string").join("").trim() === label);
  async function open() {
    await act(async () => { ui.root.findByProps({ "aria-label": "Chọn lich-su.pdf" }).props.onChange(); });
    await act(async () => { await button("Gán 1 tài liệu").props.onClick(); await flush(); });
  }
  return { ui, reads, writes, json, button, open };
}

test("library loads independently and keeps materials when assignment topics fail", async (t) => {
  const page = await setup(t, { topicError: true });
  assert.deepEqual(page.reads, ["library"]);
  assert.match(page.json(), /lich-su.pdf/);
  await page.open();
  assert.match(page.json(), /Không tải được chủ đề/);
  assert.match(page.json(), /lich-su.pdf/);
  assert.doesNotMatch(page.json(), /Chưa có tài liệu/);
  assert.equal(page.button("Gán tài liệu").props.disabled, true);
});

test("same class and subject in two terms remain separate assignment targets", async (t) => {
  const page = await setup(t);
  await page.open();
  assert.match(page.json(), /Học kỳ 1/);
  assert.match(page.json(), /Học kỳ 2/);
  assert.deepEqual(page.reads.filter(Array.isArray), [["class", "hk1"], ["class", "hk2"]]);
  const modal = page.ui.root.findByProps({ "data-modal": true });
  await act(async () => { for (const checkbox of modal.findAllByType("input").filter((node) => node.props.type === "checkbox")) checkbox.props.onChange({ target: { checked: true } }); });
  await act(async () => { await page.button("Gán tài liệu").props.onClick(); await flush(); });
  assert.deepEqual(page.writes, [{ ids: ["file"], targets: [
    { classId: "class", subjectId: "history", courseOfferingId: "hk1", topicId: "topic-hk1", lessonId: "lesson-hk1" },
    { classId: "class", subjectId: "history", courseOfferingId: "hk2", topicId: "topic-hk2", lessonId: "lesson-hk2" },
  ] }]);
});
