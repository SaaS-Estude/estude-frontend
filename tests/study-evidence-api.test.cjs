const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function loadApi() {
  const calls = [];
  const filename = path.resolve("lib/assessment-api.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (id) => {
    if (id === '@/lib/course-resource-file') return loadTypeScript('lib/course-resource-file.ts');
    if (id === "@/lib/auth-api") return {
      authenticatedRequest: async (url, options) => {
        calls.push({ url, method: options?.method ?? "GET", body: options?.body ? JSON.parse(options.body) : null });
        return {};
      },
    };
    throw new Error(`Unexpected import: ${id}`);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return { ...loaded.exports, calls };
}

test("practice actions send the current attempt id and use the server methods", async () => {
  const { examAttemptService, calls } = loadApi();
  await examAttemptService.startStudyPractice("set", "attempt", "HARD");
  await examAttemptService.submitStudyPractice("set", "attempt", [{ questionId: "question", selectedOptionIds: ["option"] }]);
  await examAttemptService.retryStudyPractice("set", "attempt", "WRONG_QUESTIONS");
  await examAttemptService.getStudyPracticeHint("set", "question", "attempt");
  await examAttemptService.getStudyPracticeAttempt("set", "attempt");
  await examAttemptService.getStudyPracticeAttemptById("attempt");
  assert.deepEqual(calls, [
    { url: "/study-practice-sets/set/start", method: "POST", body: { attemptId: "attempt", mode: "HARD" } },
    { url: "/study-practice-sets/set/submit", method: "POST", body: { attemptId: "attempt", answers: [{ questionId: "question", selectedOptionIds: ["option"] }] } },
    { url: "/study-practice-sets/set/retry", method: "POST", body: { attemptId: "attempt", practiceType: "WRONG_QUESTIONS" } },
    { url: "/study-practice-sets/set/questions/question/hint", method: "POST", body: { attemptId: "attempt" } },
    { url: "/study-practice-sets/set/attempts/attempt", method: "GET", body: null },
    { url: "/study-practice-attempts/attempt", method: "GET", body: null },
  ]);
});

test("teacher evidence selection sends the selected evidence and expected version", async () => {
  const { examService, calls } = loadApi();
  await examService.getStudentEvidence("exam", "student");
  await examService.selectStudentBaseline("exam", "student", { evidenceId: "evidence", reason: "Bài đầu kỳ", expectedVersion: 2 });
  await examService.regenerateTeacherStudyActivityReview("exam", "student", "exam-attempt");
  await examService.getTeacherStudyPracticeAttempt("exam", "student", "exam-attempt", "practice-attempt");
  assert.deepEqual(calls, [
    { url: "/exams/exam/students/student/evidence", method: "GET", body: null },
    { url: "/exams/exam/students/student/baseline", method: "POST", body: { evidenceId: "evidence", reason: "Bài đầu kỳ", expectedVersion: 2 } },
    { url: "/exams/exam/students/student/attempts/exam-attempt/study-activity/review", method: "POST", body: null },
    { url: "/exams/exam/students/student/attempts/exam-attempt/study-practice-attempts/practice-attempt", method: "GET", body: null },
  ]);
});


test("Go exam writes send bank references instead of editor answer snapshots", async () => {
  const { examService, calls } = loadApi();
  const payload = { title: "Go exam", questions: [{ questionId: "bank-question", points: 5, order: 0,
    content: "editor-only text", correctOptionIds: ["forged-answer"], explanation: "editor-only explanation" }] };
  await examService.createExam(payload);
  await examService.updateExam("exam", payload);
  await examService.createMakeup("exam", { ...payload, studentIds: ["student"], reason: "Thi bù", requestKey: "request" });
  for (const call of calls) {
    assert.deepEqual(call.body.questions, [{ questionId: "bank-question", points: 5, order: 0 }]);
    assert.equal(call.body.title, "Go exam");
  }
  assert.deepEqual(calls[2].body.studentIds, ["student"]);
});
