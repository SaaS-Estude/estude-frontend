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

function setup() {
  const pushes = [];
  const scopes = [];
  global.window = {
    location: { hash: "" },
    history: { replaceState() {} },
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const children = [
    { id: "first", fullName: "Nguyễn An", accountName: "an" },
    { id: "second", fullName: "Trần Bình", accountName: "binh" },
  ];
  const filename = path.resolve("components/parent/parent-dashboard.tsx");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "lucide-react")
      return new Proxy({}, { get: () => () => React.createElement("svg") });
    if (id === "next/navigation")
      return { useRouter: () => ({ push: (url) => pushes.push(url) }) };
    if (id === "@/context/auth-context")
      return { useAuth: () => ({ user: { fullName: "Phụ huynh" } }) };
    if (id === "@/lib/auth-api")
      return { authenticatedRequest: async () => children };
    if (id === "@/components/assessment/internal-grade-report")
      return {
        InternalGradeReport: ({ studentId }) =>
          React.createElement("div", { "data-grade-student": studentId }),
      };
    if (id === "@/components/parent/parent-shell")
      return {
        parentSections: [
          { id: "overview", label: "Tổng quan" },
          { id: "grades", label: "Sổ điểm" },
        ],
        ParentShell: ({ children: content, childrenOnly, onNavigate }) =>
          React.createElement(
            "main",
            { "data-picker": childrenOnly },
            !childrenOnly &&
              React.createElement(
                "button",
                { "data-nav": "grades", onClick: () => onNavigate("grades") },
                "Sổ điểm",
              ),
            content,
          ),
      };
    if (id === "@/components/parent/parent-overview-panels")
      return {
        useParentOverview: (enabled, studentId) => {
          scopes.push({ enabled, studentId });
          return {
            overview: enabled
              ? {
                  attendance: [],
                  upcomingExams: [],
                  notifications: [],
                  learningAlerts: [],
                  children: [children.find((item) => item.id === studentId)],
                }
              : null,
            refresh() {},
            refreshing: false,
            error: "",
          };
        },
        ParentOverviewPanels: ({ overview }) =>
          React.createElement("div", {
            "data-overview-student": overview?.children[0]?.id,
          }),
      };
    return original(id);
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
  return { Dashboard: loaded.exports.ParentDashboard, pushes, scopes };
}

test("landing page only selects a child and opens a separate URL", async (t) => {
  const { Dashboard, pushes, scopes } = setup();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Dashboard));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    delete global.window;
  });
  assert.equal(renderer.root.findByType("main").props["data-picker"], true);
  assert.ok(scopes.every((scope) => scope.enabled === false));
  await act(async () =>
    renderer.root
      .findByProps({ "aria-label": "Xem thông tin Trần Bình" })
      .props.onClick(),
  );
  assert.deepEqual(pushes, ["/parent/dashboard/second"]);
  assert.equal(
    renderer.root.findAll((node) => node.props["data-overview-student"]).length,
    0,
  );
});

test("child page uses its URL id for overview and grades and offers return to the picker", async (t) => {
  const { Dashboard, pushes, scopes } = setup();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Dashboard, { studentId: "second" }));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    delete global.window;
  });
  assert.ok(
    scopes.every((scope) => scope.enabled && scope.studentId === "second"),
  );
  assert.equal(
    renderer.root.findAllByProps({ "data-overview-student": "second" }).length,
    1,
  );
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Nguyễn An/);
  await act(async () =>
    renderer.root.findByProps({ "data-nav": "grades" }).props.onClick(),
  );
  assert.equal(
    renderer.root.findAllByProps({ "data-grade-student": "second" }).length,
    1,
  );
  await act(async () =>
    renderer.root
      .findAllByType("button")
      .find((button) => button.children.includes("Chọn học sinh khác"))
      .props.onClick(),
  );
  assert.deepEqual(pushes, ["/parent/dashboard"]);
});

test("unknown child is never replaced with the first linked child", async (t) => {
  const { Dashboard } = setup();
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Dashboard, { studentId: "unknown" }));
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    delete global.window;
  });
  assert.match(
    JSON.stringify(renderer.toJSON()),
    /liên kết không còn hiệu lực/,
  );
  assert.equal(
    renderer.root.findAll(
      (node) =>
        node.props["data-overview-student"] || node.props["data-grade-student"],
    ).length,
    0,
  );
});
