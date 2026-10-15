/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve("lib/exam-question-picker.ts");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { eligibleExamQuestions, examPickerFolderCounts } = loaded.exports;

test("exam picker includes teacher questions without a subject but excludes other subjects", () => {
  const questions = [
    { id: "same", subjectId: "biology", folderId: null, disabled: false },
    { id: "unassigned", folderId: "biology-folder", disabled: false },
    { id: "different", subjectId: "history", folderId: null, disabled: false },
    { id: "disabled", subjectId: "biology", folderId: null, disabled: true },
  ];
  const eligible = eligibleExamQuestions(questions, "biology", new Set());
  assert.deepEqual(eligible.map((question) => question.id), ["same", "unassigned"]);
  assert.deepEqual(examPickerFolderCounts(eligible), { all: 2, unfiled: 1, "biology-folder": 1 });
});

test("exam picker keeps a previously selected legacy question visible while editing", () => {
  const questions = [{ id: "legacy", subjectId: "history", folderId: null, disabled: false }];
  assert.deepEqual(eligibleExamQuestions(questions, "biology", new Set(["legacy"])).map((question) => question.id), ["legacy"]);
});
