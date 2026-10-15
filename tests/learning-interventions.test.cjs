/* eslint-disable @typescript-eslint/no-require-imports */
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
  loaded.require = (name) => {
    if (name === '@/lib/course-resource-file') return loadTypeScript('lib/course-resource-file.ts');
    if (name !== "@/lib/auth-api")
      throw new Error(`Unexpected import: ${name}`);
    return {
      authenticatedRequest: async (url, options) => {
        calls.push({
          url,
          method: options?.method ?? "GET",
          body: options?.body ? JSON.parse(options.body) : null,
        });
        return {};
      },
    };
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
  return { ...loaded.exports, calls };
}

function loadPermissions() {
  const filename = path.resolve("lib/permissions.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
  return loaded.exports;
}

test("teacher AI review sends the target and optimistic version; student feedback stays scoped to own attempt", async () => {
  const { examService, examAttemptService, calls } = loadApi();
  await examService.getTeacherStudyAnalysis("exam", "student", "attempt");
  await examService.reviewStudyAi("exam", "student", "attempt", {
    targetKey: "SUMMARY",
    decision: "EDITED",
    effectiveText: "corrected",
    reason: "source",
    expectedVersion: 2,
  });
  await examAttemptService.submitStudyAiFeedback("attempt", {
    targetKey: "SUMMARY",
    reason: "UNCLEAR",
    comment: "why?",
  });
  assert.deepEqual(calls, [
    {
      url: "/exams/exam/students/student/attempts/attempt/study-analysis",
      method: "GET",
      body: null,
    },
    {
      url: "/exams/exam/students/student/attempts/attempt/study-analysis/review",
      method: "PATCH",
      body: {
        targetKey: "SUMMARY",
        decision: "EDITED",
        effectiveText: "corrected",
        reason: "source",
        expectedVersion: 2,
      },
    },
    {
      url: "/exam-attempts/attempt/study-analysis/feedback",
      method: "POST",
      body: { targetKey: "SUMMARY", reason: "UNCLEAR", comment: "why?" },
    },
  ]);
});

test("plan draft, publish and student task actions use distinct endpoints", async () => {
  const { learningPlanService, calls } = loadApi();
  const draft = {
    studentIds: ["student"],
    objectiveId: "objective",
    title: "plan",
    summary: "why",
    successCriteria: "new assessment",
    tasks: [
      {
        kind: "MATERIAL",
        title: "read",
        description: "",
        materialId: "material",
      },
    ],
  };
  await learningPlanService.createDrafts("exam", draft);
  await learningPlanService.publish("plan", 3);
  await learningPlanService.startTask("plan", "task");
  await learningPlanService.completeMaterial("plan", "task");
  await learningPlanService.reportDifficulty("plan", "task", "hard");
  assert.deepEqual(calls, [
    { url: "/learning-plans/teacher/exams/exam", method: "POST", body: draft },
    {
      url: "/learning-plans/teacher/plan/publish",
      method: "POST",
      body: { expectedVersion: 3 },
    },
    {
      url: "/learning-plans/plan/tasks/task/start",
      method: "POST",
      body: null,
    },
    {
      url: "/learning-plans/plan/tasks/task/complete",
      method: "POST",
      body: null,
    },
    {
      url: "/learning-plans/plan/tasks/task/difficulty",
      method: "POST",
      body: { note: "hard" },
    },
  ]);
});

test("teacher can open a created learning plan with the support permission", () => {
  const { routePermission } = loadPermissions();
  assert.equal(
    routePermission("/teacher/learning-plans/plan-id"),
    "exams.submissions",
  );
});

test("student can open assigned learning plans with the study permission", () => {
  const { routePermission } = loadPermissions();
  assert.equal(routePermission("/student/learning-plans"), "study.read");
  assert.equal(
    routePermission("/student/learning-plans/plan-id"),
    "study.read",
  );
});

test("multi-class support and cohort delivery use scoped endpoints", async () => {
  const { examService, learningPlanService, calls } = loadApi();
  await examService.getLearningSupportOverview();
  await learningPlanService.listObjectives("exam");
  await learningPlanService.listForScope("class", "subject");
  await learningPlanService.publishCohort("cohort");
  assert.deepEqual(calls, [
    { url: "/exams/support/overview", method: "GET", body: null },
    {
      url: "/learning-plans/teacher/exams/exam/objectives",
      method: "GET",
      body: null,
    },
    {
      url: "/learning-plans/teacher/scopes/class/subject",
      method: "GET",
      body: null,
    },
    {
      url: "/learning-plans/teacher/cohorts/cohort/publish",
      method: "POST",
      body: null,
    },
  ]);
});

test("learning support overview sends the selected time range", async () => {
  const { examService, calls } = loadApi();
  await examService.getLearningSupportOverview({
    fresh: true,
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.deepEqual(calls, [
    {
      url: "/exams/support/overview?fresh=true&from=2026-09-01&to=2026-09-30",
      method: "GET",
      body: null,
    },
  ]);
});

test("reassessment, review, profiles and class report keep phases and scope explicit", async () => {
  const { learningPlanService, calls } = loadApi();
  const assignment = {
    examId: "new-exam",
    minimumQuestions: 5,
    equivalenceRationale: "Same objective and difficulty",
    expectedPlanVersion: 4,
  };
  const review = {
    evidenceId: "evidence",
    equivalenceConfirmed: true,
    decision: "CONFIRMED",
    reason: "Checked both attempts",
    expectedVersion: 1,
  };
  await learningPlanService.getTeacherImprovement("plan");
  await learningPlanService.getMyImprovement("plan");
  await learningPlanService.assignReassessment("plan", "AFTER", assignment);
  await learningPlanService.reviewReassessment("plan", "AFTER", review);
  await learningPlanService.classImprovementReport({
    classId: "class",
    subjectId: "subject",
    objectiveId: "objective",
  });
  assert.deepEqual(calls, [
    {
      url: "/learning-plans/teacher/plan/improvement",
      method: "GET",
      body: null,
    },
    { url: "/learning-plans/plan/improvement", method: "GET", body: null },
    {
      url: "/learning-plans/teacher/plan/reassessments/AFTER",
      method: "POST",
      body: assignment,
    },
    {
      url: "/learning-plans/teacher/plan/reassessments/AFTER/review",
      method: "POST",
      body: review,
    },
    {
      url: "/learning-plans/teacher/report?classId=class&subjectId=subject&objectiveId=objective",
      method: "GET",
      body: null,
    },
  ]);
});
