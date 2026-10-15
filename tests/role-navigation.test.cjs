/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve("lib/permissions.ts");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { canVisitRoute, MODULE_LINKS } = loaded.exports;

test("teacher navigation never points to Admin pages despite overlapping permissions", () => {
  const permissions = ["academic.read", "subjects.read", "classes.read", "teaching.read"];
  assert.equal(canVisitRoute("/admin/academic-data", "TEACHER", permissions), false);
  assert.equal(canVisitRoute("/admin/subjects", "TEACHER", permissions), false);
  assert.equal(canVisitRoute("/admin/classes", "TEACHER", permissions), false);
  assert.equal(canVisitRoute("/admin/course-offerings", "TEACHER", ["course_offerings.read"]), false);
  assert.equal(canVisitRoute("/teacher/classes", "TEACHER", permissions), true);
  assert.equal(canVisitRoute("/teacher/courses", "TEACHER", permissions), true);
  assert.equal(canVisitRoute("/teacher/classes/class-id", "TEACHER", permissions), true);
  const visible = MODULE_LINKS.filter((item) => canVisitRoute(item.href, "TEACHER", permissions));
  assert.ok(visible.some((item) => item.href === "/teacher/classes"));
  assert.ok(visible.some((item) => item.href === "/teacher/courses"));
  assert.ok(visible.every((item) => !item.href.startsWith("/admin/")));
});

test("Admin pages keep their permissions and Teacher pages remain role-bound", () => {
  assert.equal(canVisitRoute("/admin/subjects", "ADMIN", ["subjects.read"]), true);
  assert.equal(canVisitRoute("/admin/subjects", "ADMIN", []), false);
  assert.equal(canVisitRoute("/admin/course-offerings", "ADMIN", ["course_offerings.read"]), true);
  assert.equal(canVisitRoute("/admin/course-offerings", "ADMIN", []), false);
  assert.equal(canVisitRoute("/teacher/classes", "ADMIN", ["teaching.read"]), false);
  assert.equal(canVisitRoute("/teacher/classes", "TEACHER", []), false);
  assert.equal(canVisitRoute("/teacher/settings/sessions", "TEACHER", []), true);
});
