const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;

const initialCourse = { id: "course", revision: 7, displayName: "Toán - 10A - HK1", displayNameOverride: null, status: "DRAFT", academicYearId: "year", termId: "term", subjectId: "math", primaryClassId: "class", enrollmentMode: "CLASS_ROSTER", readyForOpen: true, term: { status: "ACTIVE" } };
const initialBook = { book: { id: "book", revision: 4, resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false }, items: [], students: [], term: { status: "ACTIVE" } };
const initialMembers = { teachers: [{ id: "assignment", teacherId: "t1", role: "PRIMARY_TEACHER", effectiveTo: null, user: { fullName: "Cô Lan" } }], enrollments: [] };

async function setup(t, overrides = {}) {
  const writes = [], saved = [], closed = [];
  const course = { ...initialCourse, ...overrides.course };
  const view = { ...initialBook, ...overrides.view };
  const filename = path.resolve("components/admin/course-offering-editor.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react") return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "@/context/permissions-context") return { usePermissions: () => ({ can: (key) => !overrides.denied?.includes(key) }) };
    if (id === "@/lib/course-offering-api") return { courseOfferingApi: {
      get: async () => course, members: async () => structuredClone(initialMembers),
      configure: async (id, input) => { writes.push({ id, input }); if (overrides.fail) throw new Error("Sổ điểm vừa thay đổi"); return { ...course, revision: 8, ...input }; },
    } };
    if (id === "@/lib/assessment-api") return { academicDataService: { getClassRoster: async () => ({ students: [{ id: "s1", fullName: "Nguyễn An", accountName: "an" }] }) } };
    if (id === "@/lib/gradebook-api") return { gradebookService: { get: async () => structuredClone(view) } };
    if (id === "@/lib/search-keyword") return { matchesSearchKeyword: (value, search) => value.includes(search.toLowerCase()), normalizeSearchKeyword: (value) => value.toLowerCase() };
    if (id === "@/components/ui/button") return { Button: ({ children, permission, ...props }) => React.createElement("button", props, children) };
    if (id === "@/components/ui/modal") return { Modal: ({ children, footer, onClose }) => React.createElement("section", null, children, React.createElement("footer", null, footer), React.createElement("button", { "aria-label": "Đóng", onClick: onClose })) };
    if (id === "@/components/ui/form-control") return {
      Input: ({ label, hint, icon, ...props }) => React.createElement("input", { "aria-label": label, ...props }),
      CustomSelect: ({ label, options, onValueChange, value, disabled }) => React.createElement("select", { "aria-label": label, value, disabled, onChange: (event) => onValueChange(event.target.value) }, options.map((option) => React.createElement("option", { key: option.value, value: option.value, disabled: option.disabled }, option.label))),
      Checkbox: (props) => React.createElement("input", { type: "checkbox", ...props }),
    };
    if (id === "./gradebook-policy-fields") return {
      defaultGradePolicy: { resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false },
      GradebookPolicyFields: ({ policy, onChange, disabled }) => React.createElement("select", { "aria-label": "Hình thức đánh giá", disabled, value: policy.assessmentMode, onChange: (event) => onChange({ ...policy, assessmentMode: event.target.value }) }),
    };
    return original(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(loaded.exports.CourseOfferingEditor, { course, teachers: [{ id: "t1", fullName: "Cô Lan" }, { id: "t2", fullName: "Cô Hương" }, { id: "t3", fullName: "Thầy Minh" }], yearName: "2026–2027", termName: "HK1", subjectName: "Toán", className: "10A", onClose: () => closed.push(true), onSaved: (value) => saved.push(value) }));
    await new Promise(setImmediate);
  });
  t.after(async () => { await act(async () => renderer.unmount()); });
  const field = (label) => renderer.root.findByProps({ "aria-label": label });
  const change = async (label, value) => act(async () => { field(label).props.onChange({ target: { value } }); });
  const submit = async () => act(async () => { await renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  return { renderer, field, change, submit, writes, saved, closed };
}

test("editing and cancelling a course never writes any field", async (t) => {
  const ui = await setup(t);
  await ui.change("Tên hiển thị môn học", "Tên chưa lưu");
  await ui.change("Giáo viên chính", "t2");
  await ui.change("Trạng thái giảng dạy", "OPEN");
  await ui.change("Hình thức đánh giá", "COMMENT");
  assert.equal(ui.writes.length, 0);
  const cancel = ui.renderer.root.findAllByType("button").find((button) => button.children.includes("Hủy"));
  await act(async () => cancel.props.onClick());
  assert.equal(ui.closed.length, 1);
  assert.equal(ui.writes.length, 0);
});

test("confirm sends a single request containing all edited fields", async (t) => {
  const ui = await setup(t);
  await ui.change("Tên hiển thị môn học", "  Toán nâng cao  ");
  await ui.change("Giáo viên chính", "t2");
  await ui.change("Trạng thái giảng dạy", "OPEN");
  await ui.change("Hình thức đánh giá", "COMMENT");
  await ui.submit();
  assert.deepEqual(ui.writes, [{ id: "course", input: { revision: 7, displayNameOverride: "Toán nâng cao", status: "OPEN", teachers: [{ teacherId: "t2", role: "PRIMARY_TEACHER" }], gradebook: { resultMode: "INTERNAL", assessmentMode: "COMMENT", annualPeriods: 35, specialized: false, revision: 4 } } }]);
  assert.equal(ui.saved.length, 1);
});

test("failed confirmation keeps edits and displays the server error", async (t) => {
  const ui = await setup(t, { fail: true });
  await ui.change("Tên hiển thị môn học", "Tên mới");
  await ui.submit();
  assert.equal(ui.field("Tên hiển thị môn học").props.value, "Tên mới");
  assert.equal(ui.saved.length, 0);
  assert.equal(ui.closed.length, 0);
  assert.match(JSON.stringify(ui.renderer.toJSON()), /Sổ điểm vừa thay đổi/);
});

test("confirming unchanged data does not create assignment histories", async (t) => {
  const ui = await setup(t);
  await ui.submit();
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.closed.length, 1);
});

test("upcoming semesters keep opening disabled while allowing draft edits", async (t) => {
  const ui = await setup(t, { course: { term: { status: "UPCOMING" } } });
  const option = ui.field("Trạng thái giảng dạy").findAllByType("option").find((option) => option.props.value === "OPEN");
  assert.equal(option.props.disabled, true);
  await ui.change("Tên hiển thị môn học", "Toán học kỳ tới");
  await ui.submit();
  assert.deepEqual(ui.writes[0].input, { revision: 7, displayNameOverride: "Toán học kỳ tới" });
});

test("courses with marks retain their gradebook configuration", async (t) => {
  const ui = await setup(t, { view: { items: [{ id: "item" }] } });
  assert.equal(ui.field("Hình thức đánh giá").props.disabled, true);
  await ui.change("Tên hiển thị môn học", "Tên mới");
  await ui.submit();
  assert.equal(ui.writes[0].input.gradebook, undefined);
});

test("an unused historical book is configured with the activity model", async (t) => {
  const ui = await setup(t, { view: { book: { ...initialBook.book, resultMode: "LEGACY", annualPeriods: 70, specialized: true } } });
  await ui.submit();
  assert.deepEqual(ui.writes[0].input.gradebook, { resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false, revision: 4 });
});

test("editing a course preserves historical books that already have grades", async (t) => {
  const ui = await setup(t, { view: { book: { ...initialBook.book, resultMode: "LEGACY", annualPeriods: 70, specialized: true }, items: [{ id: "item" }] } });
  await ui.change("Tên hiển thị môn học", "Tên mới");
  await ui.submit();
  assert.equal(ui.writes[0].input.gradebook, undefined);
});
