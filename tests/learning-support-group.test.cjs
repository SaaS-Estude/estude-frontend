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
const visibleText = (node) =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(visibleText).join("")
      : node?.children
        ? visibleText(node.children)
        : "";

const student = (id, name, topic) => ({
  id,
  fullName: name,
  level: "HIGH",
  gaps: [{ topicName: topic }],
});

async function render(
  t,
  hasMaterial,
  objectives = [
    {
      id: "objective",
      title: "Chủ đề A",
      granularity: "TOPIC",
      topicId: "topic",
    },
  ],
  reportMaterialAvailable = hasMaterial,
) {
  const calls = [];
  const suggestionCalls = [];
  const filename = path.resolve(
    "components/assessment/learning-support-group-panel.tsx",
  );
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/link")
      return { default: (props) => React.createElement("a", props) };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/ui/date-range-picker")
      return {
        DateTimePicker: (props) =>
          React.createElement("date-time-picker", props),
      };
    if (id === "@/components/ui/form-control")
      return {
        CustomSelect: (props) => React.createElement("custom-select", props),
        Input: (props) => React.createElement("input", props),
        Textarea: (props) => React.createElement("textarea", props),
      };
    if (id === "@/lib/assessment-api")
      return {
        academicDataService: {
          getClassTopics: async () => [
            {
              id: "topic",
              subjectId: "subject",
              name: "Chủ đề A",
              materials: [
                {
                  id: "material",
                  status: "READY",
                  originalName: "Tài liệu A.pdf",
                },
              ],
            },
          ],
        },
        learningPlanService: {
          listObjectives: async () => [
            ...objectives,
            ...(hasMaterial ? [{
              id: "material-objective",
              title: "Tài liệu A.pdf",
              granularity: "MATERIAL",
              topicId: null,
              materialId: "material",
              topicNames: ["Chủ đề A"],
            }] : []),
          ],
          listForScope: async () => [],
          prepareMaterial: async (examId, studentId, materialId) => ({
            analysisId: `analysis-${studentId}`,
            practiceSetId: `practice-${studentId}`,
            materialId,
            materialName: "Tài liệu A.pdf",
            sourceAttemptId: `attempt-${studentId}`,
            baselineExamAccuracy: 40,
            missedCount: 2,
            matchedCount: 1,
            summary: `Ôn mục 1 cho ${studentId}`,
            sections: [{ title: "Mục 1", page: 2, missedCount: 1, questionIds: ["q1"],
              diagnosis: "Sai kiến thức", theory: "Lý thuyết mục 1", keyPoints: ["Ý chính"],
              citations: [{ documentName: "Tài liệu A.pdf", page: 2, excerpt: "Đoạn nguồn" }] }],
          }),
          suggest: async (examId, studentId, objectiveId) => {
            suggestionCalls.push({ examId, studentId, objectiveId });
            return {
              title: "Ôn tập Chủ đề A",
              summary: "Cần củng cố Chủ đề A",
              evidence: `Bằng chứng của ${studentId}`,
              tasks: [],
            };
          },
          createDrafts: async (examId, input) => {
            calls.push({ examId, input });
            return {
              cohortId: "cohort",
              plans: input.studentIds.map((studentId) => ({
                id: `plan-${studentId}`,
                cohortId: "cohort",
                studentId,
                title: input.title,
                status: "DRAFT",
              })),
            };
          },
          publishCohort: async (cohortId) => {
            calls.push({ cohortId });
            return {
              cohortId,
              published: ["plan-s1", "plan-s2"],
              failed: [],
            };
          },
        },
      };
    return originalRequire(id);
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
  const report = {
    classId: "class",
    subjectId: "subject",
    version: "v1",
    materialContext: {
      available: reportMaterialAvailable,
      readyMaterialCount: reportMaterialAvailable ? 1 : 0,
    },
    students: [
      student("s1", "An", "Chủ đề A"),
      student("s2", "Bình", "Chủ đề A"),
    ],
  };
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(loaded.exports.LearningSupportGroupPanel, {
        examId: "exam",
        report,
      }),
    );
    await new Promise(setImmediate);
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return {
    renderer,
    calls,
    suggestionCalls,
    text: () => visibleText(renderer.toJSON()),
  };
}

test("groups at-risk students by topic and creates one cohort draft for the selection", async (t) => {
  const page = await render(t, true);
  assert.match(page.text(), /Chủ đề A/);
  assert.match(page.text(), /Đã chọn 2\/2 sinh viên/);
  assert.deepEqual(page.renderer.root.findByType("custom-select").props.options, [
    { value: "objective", label: "Chủ đề A" },
    { value: "material-objective", label: "Tài liệu · Tài liệu A.pdf" },
  ]);
  await act(async () => {
    page.renderer.root
      .findByType("custom-select")
      .props.onValueChange("objective");
  });
  const suggest = page.renderer.root
    .findAllByType("button")
    .find((item) => visibleText(item) === "Tạo đề xuất bằng AI");
  assert.equal(suggest.props.disabled, false);
  await act(async () => {
    await suggest.props.onClick();
  });
  assert.deepEqual(page.suggestionCalls, [
    { examId: "exam", studentId: "s1", objectiveId: "objective" },
    { examId: "exam", studentId: "s2", objectiveId: "objective" },
  ]);
  await act(async () => {
    page.renderer.root
      .findByProps({ placeholder: "Ôn tập Chủ đề A" })
      .props.onChange({ target: { value: "Ôn tập nhóm A" } });
    page.renderer.root
      .findByProps({ placeholder: "Điều kiện cụ thể để xác nhận tiến bộ" })
      .props.onChange({ target: { value: "Đạt bài đánh giá lại" } });
  });
  const approve = page.renderer.root
    .findAllByType("button")
    .find((item) => visibleText(item).includes("Duyệt và giao cho"));
  assert.equal(approve.props.disabled, false);
  await act(async () => {
    await approve.props.onClick();
  });
  assert.deepEqual(page.calls, [
    {
      examId: "exam",
      input: {
        studentIds: ["s1", "s2"],
        objectiveId: "objective",
        title: "Ôn tập nhóm A",
        summary:
          "AI đề xuất cho 2 học sinh cùng cần củng cố Chủ đề A. Căn cứ: Cần củng cố Chủ đề A Bằng chứng của s1 Bằng chứng của s2",
        successCriteria: "Đạt bài đánh giá lại",
        targetAccuracyPercent: 70,
        dueAt: undefined,
        tasks: [
          {
            kind: "MATERIAL",
            title: "Đọc và ôn Chủ đề A",
            description:
              "Đọc tài liệu đã gắn và chuẩn bị cho bài đánh giá lại.",
            materialId: "material",
          },
          {
            kind: "PRACTICE",
            title: "Luyện tập Chủ đề A",
            description:
              "Mỗi học sinh làm bộ câu luyện riêng đúng mục tiêu kiến thức trước khi đánh giá lại.",
          },
        ],
      },
    },
    { cohortId: "cohort" },
  ]);
  assert.match(page.text(), /Lộ trình đã tạo · 1 đợt/);
  assert.match(page.text(), /0 bản nháp · 2 đã giao/);
  assert.match(page.text(), /Tạo lúc \d{2}:\d{2} · \d{2}\/\d{2}\/\d{4}/);
});

test("shows exam risk groups but no plan composer without attached material", async (t) => {
  const page = await render(t, false);
  assert.match(page.text(), /Nguy cơ từ bài kiểm tra/);
  assert.doesNotMatch(page.text(), /Chủ đề A/);
  assert.match(page.text(), /Đã chọn 2\/2 sinh viên/);
  assert.match(page.text(), /chỉ theo dõi nguy cơ từ bài kiểm tra/);
  assert.doesNotMatch(page.text(), /AI đề xuất lộ trình cho nhóm đã chọn/);
});

test("offers the subject material when questions have no topic", async (t) => {
  const page = await render(t, true, [
    {
      id: "question-1",
      title: "Câu hỏi chưa gắn chủ đề",
      granularity: "QUESTION",
      topicId: null,
    },
    {
      id: "question-2",
      title: "Câu hỏi chưa gắn chủ đề",
      granularity: "QUESTION",
      topicId: null,
    },
  ]);
  assert.doesNotMatch(page.text(), /2 câu hỏi chưa gắn chủ đề/);
  assert.match(page.text(), /Chưa có mục tiêu theo chủ đề/);
  const objectiveSelect = page.renderer.root.findByType("custom-select");
  assert.equal(objectiveSelect.props.disabled, false);
  assert.deepEqual(objectiveSelect.props.options, [
    { value: "material-objective", label: "Tài liệu · Tài liệu A.pdf" },
  ]);
  await act(async () => objectiveSelect.props.onValueChange("material-objective"));
  assert.match(page.text(), /đối chiếu câu sai với tài liệu/);
  const suggest = page.renderer.root
    .findAllByType("button")
    .find((item) => visibleText(item) === "Tạo đề xuất bằng AI");
  assert.equal(suggest.props.disabled, false);
  await act(async () => suggest.props.onClick());
  assert.match(page.text(), /Lý thuyết mục 1/);
  assert.match(page.text(), /Đoạn nguồn/);
  assert.equal(page.suggestionCalls.length, 0);
  const approve = page.renderer.root
    .findAllByType("button")
    .find((item) => visibleText(item).includes("Duyệt và giao cho"));
  assert.equal(approve.props.disabled, false);
  await act(async () => approve.props.onClick());
  assert.equal(page.calls[0].input.objectiveId, "material-objective");
  assert.equal(page.calls[0].input.targetAccuracyPercent, 70);
  assert.deepEqual(page.calls[0].input.tasks.map((task) => task.kind), ["MATERIAL", "PRACTICE"]);
});

test("shows material choices even when the cached report still says no material", async (t) => {
  const page = await render(t, true, [], false);
  assert.match(page.text(), /AI đề xuất lộ trình cho nhóm đã chọn/);
  assert.deepEqual(page.renderer.root.findByType("custom-select").props.options, [
    { value: "material-objective", label: "Tài liệu · Tài liệu A.pdf" },
  ]);
});
