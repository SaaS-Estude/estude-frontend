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
const flush = () => new Promise(setImmediate);
const textOf = (node) =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : textOf(node?.children ?? []);
class ApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function load(filename, api = {}) {
  const absolute = path.resolve(filename);
  const loaded = new Module(absolute, module);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "@/lib/assessment-api") return api;
    if (id === "@/lib/auth-api") return { ApiError };
    if (id === "next/link")
      return { default: (props) => React.createElement("a", props) };
    if (id === "@/components/ui/button")
      return { Button: (props) => React.createElement("button", props) };
    if (id === "@/components/assessment/learning-improvement-panel")
      return { TeacherImprovementPanel: () => null };
    if (id === "@/components/assessment/teacher-study-progress")
      return {
        TeacherStudyProgress: () => null,
        TeacherStudyProgressFeedback: () => null,
      };
    if (id.startsWith("@/components/")) return load(`${id.slice(2)}.tsx`, api);
    return originalRequire(id);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    absolute,
  );
  return loaded.exports;
}

function analysis() {
  const report = {
    summary: "Tổng quan đã chỉnh sửa",
    aiStatus: "READY",
    analysisScope: "MATERIAL_GROUNDED",
    exam: {
      title: "Kiểm tra lịch sử",
      subjectName: "Lịch sử",
      className: "12A",
    },
    performance: {
      score: 2,
      totalPoints: 10,
      accuracy: 20,
      correctCount: 1,
      totalQuestions: 5,
      ungradedEssayCount: 0,
      needsWarning: true,
    },
    historyAnalysisCount: 2,
    learningProfile: [
      {
        topicName: "Trật tự thế giới",
        masteryEstimate: 35,
        sampleSize: 10,
        evidenceLevel: "SUFFICIENT",
        trend: "DECLINING",
        recommendedDifficulty: "EASY",
        recommendation: "Củng cố kiến thức nền",
      },
    ],
    topicPerformance: [
      {
        topicName: "Trật tự thế giới",
        correctCount: 1,
        totalQuestions: 5,
        accuracy: 20,
      },
    ],
    weakAreas: [
      {
        id: "area",
        topicName: "Trật tự thế giới",
        sourceType: "COURSE_MATERIAL",
        missedCount: 4,
        totalQuestions: 5,
        diagnosis: "Nhận định đã chỉnh sửa",
        reviewSummary: "Ôn lại hội nghị",
        keyPoints: ["Mốc năm 1945"],
        sourceReferences: [{ documentName: "Lịch sử.pdf", page: 12 }],
      },
    ],
    learningPath: {
      totalDurationMinutes: 15,
      steps: [
        {
          order: 1,
          topicName: "Trật tự thế giới",
          title: "Đọc lại bài",
          objective: "Hiểu quyết định hội nghị",
          activities: ["Lập bảng so sánh"],
          durationMinutes: 15,
        },
      ],
    },
    reviewStates: {
      SUMMARY: { decision: "EDITED", reason: "Đối chiếu tài liệu", version: 1 },
    },
  };
  return {
    id: "analysis",
    generatedAt: "2026-09-29T00:00:00Z",
    report,
    rawReport: { ...report, summary: "Tổng quan AI gốc" },
    rawPracticeQuestions: [],
    reviews: [],
    reviewHistory: [],
    feedback: [],
    practiceSet: null,
  };
}

const props = {
  examId: "exam",
  studentId: "student",
  attemptId: "attempt",
  classId: "class",
  subjectId: "subject",
};
function apiFor(view, overrides = {}) {
  return {
    examService: {
      getTeacherStudyAnalysis: async () => view,
      createTeacherStudyAnalysis: async () => view,
      getClassReport: async () => ({ students: [] }),
      getStudentEvidence: async () => ({ items: [], baselines: [] }),
      ...overrides,
    },
    learningPlanService: { listTeacher: async () => [] },
    academicDataService: { getClassTopics: async () => [] },
  };
}
async function mount(t, component, properties) {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(component, properties));
    await flush();
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return renderer;
}

test("student analysis loader reuses saved data and creates only when missing", async () => {
  const saved = analysis();
  let creates = 0;
  const { loadOrCreateStudentStudyAnalysis } = load(
    "lib/study-analysis-loader.ts",
    {
      examAttemptService: {
        getStudyAnalysis: async () => saved,
        createStudyAnalysis: async () => {
          creates++;
          return saved;
        },
      },
    },
  );

  assert.equal(await loadOrCreateStudentStudyAnalysis("attempt"), saved);
  assert.equal(creates, 0);

  const { loadOrCreateStudentStudyAnalysis: createMissing } = load(
    "lib/study-analysis-loader.ts",
    {
      examAttemptService: {
        getStudyAnalysis: async () => {
          throw new ApiError(404);
        },
        createStudyAnalysis: async () => {
          creates++;
          return saved;
        },
      },
    },
  );
  assert.equal(await createMissing("attempt"), saved);
  assert.equal(creates, 1);
});

test("student and teacher share all analysis details; only the student can send feedback", async (t) => {
  const { StudyAnalysisDetails } = load(
    "components/assessment/study-analysis-details.tsx",
  );
  const report = analysis().report;
  const teacher = await mount(t, StudyAnalysisDetails, { report });
  const student = await mount(t, StudyAnalysisDetails, {
    report,
    onFeedback: async () => {},
  });
  for (const renderer of [teacher, student]) {
    const shown = textOf(renderer.toJSON());
    for (const value of [
      "Hồ sơ học tập cá nhân",
      "35%",
      "10 câu quan sát",
      "Nhận định đã chỉnh sửa",
      "Mốc năm 1945",
      "Lịch sử.pdf",
      "trang 12",
      "Lập bảng so sánh",
    ])
      assert.ok(shown.includes(value), value);
  }
  assert.equal(teacher.root.findAllByType("button").length, 0);
  assert.equal(student.root.findAllByType("button").length, 2);
});

test("teacher analysis sections stay collapsed until the teacher opens them", async (t) => {
  const view = analysis();
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(view),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  const summaries = renderer.root
    .findAllByType("summary")
    .map((item) => textOf(item));

  for (const label of [
    "Nhận định tổng quan của AI",
    "Hồ sơ học tập cá nhân",
    "Gợi ý ôn tập",
    "Nội dung cần ôn lại",
  ]) {
    assert.ok(
      summaries.some((summary) => summary.includes(label)),
      label,
    );
  }
  assert.doesNotMatch(
    textOf(renderer.toJSON()),
    /Duyệt nội dung AI đề xuất/,
  );
  assert.doesNotMatch(
    textOf(renderer.toJSON()),
    /Giao nhiệm vụ cho học sinh này/,
  );
  assert.ok(
    renderer.root
      .findAllByType("details")
      .every((details) => details.props.open !== true),
  );
  const shown = textOf(renderer.toJSON());
  assert.doesNotMatch(shown, /Kết quả theo chủ đề/);
  assert.doesNotMatch(shown, /AI gợi ý .*Chưa phải nhiệm vụ đã giao/);
  assert.doesNotMatch(
    shown,
    /Lộ trình đề xuất|Xem và tạo lộ trình theo nhóm|Lộ trình của lớp|Tạo kế hoạch cho nhóm học sinh|Chọn mục tiêu, người nhận/,
  );
});

test("assessment-only comparison keeps observed data and hides old AI advice", async (t) => {
  const view = analysis();
  view.report.analysisScope = "ASSESSMENT_ONLY";
  view.report.aiStatus = "SKIPPED_NO_MATERIAL";
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(view),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  const shown = textOf(renderer.toJSON());
  assert.match(shown, /Ước lượng từ kết quả kiểm tra/);
  assert.doesNotMatch(shown, /Kết quả theo chủ đề/);
  assert.doesNotMatch(
    shown,
    /Nhận định đã chỉnh sửa|Lập bảng so sánh|Tổng quan AI gốc|Củng cố kiến thức nền/,
  );
});

test("unclassified questions do not recreate the removed topic-results section", async (t) => {
  const { StudyAnalysisDetails } = load(
    "components/assessment/study-analysis-details.tsx",
  );
  const report = analysis().report;
  report.learningProfile = Array.from({ length: 5 }, (_, index) => ({
    objectiveId: `objective-${index}`,
    topicName: "Kiến thức tổng hợp",
    masteryEstimate: index === 0 ? 75 : 25,
    sampleSize: 1,
    evidenceLevel: "LIMITED",
    trend: "INSUFFICIENT_DATA",
    recommendedDifficulty: "EASY",
    recommendation:
      "Dữ liệu còn ít; luyện thêm câu nền tảng để xác định phần cần củng cố.",
  }));
  report.topicPerformance = Array.from({ length: 5 }, (_, index) => ({
    objectiveId: `objective-${index}`,
    topicName: "Kiến thức tổng hợp",
    totalQuestions: 1,
    correctCount: index === 0 ? 1 : 0,
    missedCount: index === 0 ? 0 : 1,
    pointsEarned: index === 0 ? 2 : 0,
    pointsPossible: 2,
    accuracy: index === 0 ? 100 : 0,
  }));
  const renderer = await mount(t, StudyAnalysisDetails, { report });
  const shown = textOf(renderer.toJSON());
  assert.doesNotMatch(shown, /Bài này có 5 câu chưa được gắn chủ đề/);
  assert.doesNotMatch(shown, /Kết quả theo chủ đề|Toàn bài · chưa phân loại chủ đề/);
  assert.doesNotMatch(shown, /Dữ liệu còn ít; luyện thêm câu nền tảng/);
  assert.doesNotMatch(shown, /1 câu quan sát/);
});

test("teacher receives the effective student report without loading planning data", async (t) => {
  const view = analysis();
  let evidenceLoads = 0;
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(view, {
      getStudentEvidence: async () => {
        evidenceLoads += 1;
        throw new Error("Không tải được bằng chứng");
      },
    }),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  const shown = textOf(renderer.toJSON());
  assert.equal(evidenceLoads, 0);
  assert.match(shown, /Phân tích học sinh đang xem/);
  assert.doesNotMatch(shown, /Bấm để xem nội dung và trạng thái duyệt/);
  assert.match(shown, /Kiểm tra lịch sử · 12A/);
  assert.doesNotMatch(shown, /Kiểm tra lịch sử · Lịch sử · 12A/);
  assert.match(shown, /Phân tích đã được lưu lúc/);
  assert.match(shown, /Giáo viên và học sinh đang xem cùng dữ liệu này/);
  assert.match(shown, /Tổng quan đã chỉnh sửa/);
  assert.doesNotMatch(shown, /Tổng quan AI gốc/);
  assert.doesNotMatch(shown, /Kết quả theo chủ đề/);
  assert.doesNotMatch(shown, /Môn học chưa có tài liệu được gắn/);
});

test("teacher can request a fresh analysis for the opened submission", async (t) => {
  const calls = [];
  const refreshed = analysis();
  refreshed.generatedAt = "2026-09-30T08:30:00Z";
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(analysis(), {
      createTeacherStudyAnalysis: async (...args) => {
        calls.push(args);
        return refreshed;
      },
    }),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  const button = renderer.root
    .findAllByType("button")
    .find((item) => textOf(item).includes("Phân tích lại"));
  assert.ok(button);
  await act(async () => {
    button.props.onClick();
    await flush();
  });
  assert.deepEqual(calls, [["exam", "student", "attempt"]]);
  assert.match(textOf(renderer.toJSON()), /15:30:00 30\/9\/2026/);
});

test("missing analysis is created for the selected submission", async (t) => {
  const calls = [];
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(analysis(), {
      getTeacherStudyAnalysis: async () => {
        throw new ApiError(404);
      },
      createTeacherStudyAnalysis: async (...args) => {
        calls.push(args);
        return analysis();
      },
    }),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  assert.deepEqual(calls, [["exam", "student", "attempt"]]);
  assert.match(textOf(renderer.toJSON()), /Tổng quan đã chỉnh sửa/);
});

test("permission errors do not generate analyses and can be retried", async (t) => {
  let reads = 0;
  let creates = 0;
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(analysis(), {
      getTeacherStudyAnalysis: async () => {
        if (++reads === 1) throw new ApiError(403);
        return analysis();
      },
      createTeacherStudyAnalysis: async () => {
        creates++;
        return analysis();
      },
    }),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  assert.match(textOf(renderer.toJSON()), /HTTP 403/);
  const retry = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button) === "Tải lại phân tích");
  await act(async () => {
    retry.props.onClick();
    await flush();
  });
  assert.equal(creates, 0);
  assert.equal(reads, 2);
  assert.match(textOf(renderer.toJSON()), /Tổng quan đã chỉnh sửa/);
});

test("late response for another student cannot replace the selected student's analysis", async (t) => {
  let resolveOld;
  const { StudentInterventionPanel } = load(
    "components/assessment/student-intervention-panel.tsx",
    apiFor(analysis(), {
      getTeacherStudyAnalysis: async (_exam, studentId) =>
        studentId === "student"
          ? new Promise((resolve) => {
              resolveOld = resolve;
            })
          : analysis(),
    }),
  );
  const renderer = await mount(t, StudentInterventionPanel, props);
  assert.match(textOf(renderer.toJSON()), /Đang tải phân tích/);
  await act(async () => {
    renderer.update(
      React.createElement(StudentInterventionPanel, {
        ...props,
        studentId: "next",
        attemptId: "next-attempt",
      }),
    );
    await flush();
  });
  const stale = analysis();
  stale.report.summary = "Báo cáo học sinh cũ";
  await act(async () => {
    resolveOld(stale);
    await flush();
  });
  assert.doesNotMatch(textOf(renderer.toJSON()), /Báo cáo học sinh cũ/);
  assert.match(textOf(renderer.toJSON()), /Tổng quan đã chỉnh sửa/);
});

test("teacher handles a topic through one entry action and completed actions disappear", async (t) => {
  const view = analysis();
  view.report.topicSuggestions = [
    {
      questionId: "question",
      order: 0,
      content: "Hội nghị Ianta",
      topicName: "Quan hệ quốc tế",
      sourceReferences: [
        {
          materialId: "material",
          documentName: "Lịch sử.pdf",
          page: 12,
          excerpt: "Nội dung trích dẫn để giáo viên đối chiếu",
        },
      ],
    },
  ];
  view.reviews = [];
  const calls = [];
  let refreshed = 0;
  const { StudyTopicSuggestionsPanel } = load(
    "components/assessment/study-topic-suggestions-panel.tsx",
    apiFor(view, {
      reviewStudyAi: async (...args) => {
        calls.push(args);
        return {};
      },
    }),
  );
  const renderer = await mount(t, StudyTopicSuggestionsPanel, {
    ...props,
    analysis: view,
    onChanged: async () => {
      refreshed++;
    },
  });
  assert.match(textOf(renderer.toJSON()), /Lịch sử.pdf · trang 12/);
  assert.equal(
    renderer.root
      .findAllByType("button")
      .filter((button) => textOf(button) === "Xử lý đề xuất").length,
    1,
  );
  await act(async () => {
    renderer.root
      .findAllByType("button")
      .find((button) => textOf(button) === "Xử lý đề xuất")
      .props.onClick();
  });
  await act(async () =>
    renderer.root
      .findByType("input")
      .props.onChange({ target: { value: "Trật tự thế giới" } }),
  );
  const confirm = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button) === "Dùng chủ đề này");
  await act(async () => {
    confirm.props.onClick();
    await flush();
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), ["exam", "student", "attempt"]);
  assert.equal(calls[0][3].targetKey, "TOPIC:question");
  assert.equal(calls[0][3].decision, "EDITED");
  assert.equal(calls[0][3].effectiveText, "Trật tự thế giới");
  assert.equal(calls[0][3].expectedVersion, 0);
  assert.equal(refreshed, 1);

  view.reviews = [
    {
      targetKey: "TOPIC:question",
      decision: "CONFIRMED",
      version: 1,
      reason: "Đã đối chiếu",
      effectiveText: JSON.stringify({
        topicId: "topic",
        topicName: "Trật tự thế giới",
      }),
    },
  ];
  await act(async () => {
    renderer.update(
      React.createElement(StudyTopicSuggestionsPanel, {
        ...props,
        analysis: view,
        onChanged: async () => {},
      }),
    );
  });
  assert.doesNotMatch(textOf(renderer.toJSON()), /Hội nghị Ianta/);
  assert.match(textOf(renderer.toJSON()), /Đã xử lý xong các chủ đề được đề xuất/);
  assert.equal(
    renderer.root
      .findAllByType("button")
      .filter((button) => textOf(button) === "Xử lý đề xuất").length,
    0,
  );
});

test("rejecting a suggested topic requires and stores the teacher comment", async (t) => {
  const view = analysis();
  view.report.topicSuggestions = [
    {
      questionId: "question",
      order: 0,
      content: "Hội nghị Ianta",
      topicName: "Chủ đề chương I",
      sourceReferences: [],
    },
  ];
  const calls = [];
  const { StudyTopicSuggestionsPanel } = load(
    "components/assessment/study-topic-suggestions-panel.tsx",
    apiFor(view, {
      reviewStudyAi: async (...args) => {
        calls.push(args);
        return {};
      },
    }),
  );
  const renderer = await mount(t, StudyTopicSuggestionsPanel, {
    ...props,
    analysis: view,
    onChanged: async () => {},
  });
  await act(async () => {
    renderer.root
      .findAllByType("button")
      .find((button) => textOf(button) === "Xử lý đề xuất")
      .props.onClick();
  });
  await act(async () => {
    renderer.root
      .findAllByType("button")
      .find((button) => textOf(button) === "Bác bỏ đề xuất")
      .props.onClick();
  });
  const reject = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button) === "Xác nhận bác bỏ");
  assert.equal(reject.props.disabled, true);
  await act(async () => {
    renderer.root
      .findByType("textarea")
      .props.onChange({ target: { value: "Tên chủ đề quá rộng" } });
  });
  const enabledReject = renderer.root
    .findAllByType("button")
    .find((button) => textOf(button) === "Xác nhận bác bỏ");
  assert.equal(enabledReject.props.disabled, false);
  await act(async () => {
    enabledReject.props.onClick();
    await flush();
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][3].decision, "REJECTED");
  assert.equal(calls[0][3].reason, "Tên chủ đề quá rộng");
});

test("no source-backed topic match stays explicit and never confirms a topic automatically", async (t) => {
  let confirmed = 0;
  const { StudyTopicSuggestionsPanel } = load(
    "components/assessment/study-topic-suggestions-panel.tsx",
    apiFor(analysis(), {
      suggestStudyTopics: async () => analysis(),
      reviewStudyAi: async () => {
        confirmed++;
      },
    }),
  );
  const renderer = await mount(t, StudyTopicSuggestionsPanel, {
    ...props,
    analysis: analysis(),
    onChanged: async () => {},
  });
  await act(async () => {
    renderer.root.findByType("button").props.onClick();
    await flush();
  });
  assert.match(
    textOf(renderer.toJSON()),
    /Chưa tìm được chủ đề có đủ căn cứ trong tài liệu/,
  );
  assert.equal(confirmed, 0);
});

test("opening an unclassified report starts source-backed topic matching automatically", async (t) => {
  const view = analysis();
  view.rawReport.topicPerformance = [
    { topicName: "Kiến thức tổng hợp", totalQuestions: 5 },
  ];
  let suggestions = 0;
  const { StudyTopicSuggestionsPanel } = load(
    "components/assessment/study-topic-suggestions-panel.tsx",
    apiFor(view, {
      suggestStudyTopics: async () => {
        suggestions++;
        return {
          ...view,
          report: {
            ...view.report,
            topicSuggestions: [
              {
                questionId: "question",
                order: 0,
                content: "Câu hỏi",
                topicName: "Lịch sử",
                sourceReferences: [],
              },
            ],
          },
        };
      },
    }),
  );
  const renderer = await mount(t, StudyTopicSuggestionsPanel, {
    ...props,
    analysis: view,
    onChanged: async () => {},
  });
  assert.equal(suggestions, 1);
  assert.match(textOf(renderer.toJSON()), /Đã tìm chủ đề đề xuất/);
});
