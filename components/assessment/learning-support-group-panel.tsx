"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  Eye,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-range-picker";
import { CustomSelect, Input, Textarea } from "@/components/ui/form-control";
import { learningPlanService } from "@/lib/assessment-api";
import type {
  LearningObjectiveEvidence,
  LearningPlan,
  LearningPlanScopeItem,
  MaterialPlanProposal,
  SubjectSupportReport,
  SubjectSupportStudent,
} from "@/types/assessment";

const unclassified = "Chưa xác định chủ đề";
const examRisk = "Nguy cơ từ bài kiểm tra";
const genericTopics = new Set(["Kiến thức tổng hợp", "Chưa gắn chủ đề"]);

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  const dateText = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timeText = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${timeText} · ${dateText}`;
}

function groupStudents(
  students: SubjectSupportStudent[],
  hasMaterial: boolean,
) {
  const groups = new Map<
    string,
    { name: string; students: SubjectSupportStudent[] }
  >();
  for (const student of students) {
    if (student.level !== "HIGH" && student.level !== "WATCH") continue;
    if (!hasMaterial) {
      const group = groups.get(examRisk) ?? { name: examRisk, students: [] };
      group.students.push(student);
      groups.set(examRisk, group);
      continue;
    }
    const topics = [
      ...new Set(
        student.gaps
          .map((gap) => gap.topicName?.trim())
          .filter(
            (name): name is string => Boolean(name) && !genericTopics.has(name),
          ),
      ),
    ];
    for (const name of topics.length ? topics : [unclassified]) {
      const group = groups.get(name) ?? { name, students: [] };
      if (!group.students.some((item) => item.id === student.id))
        group.students.push(student);
      groups.set(name, group);
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.students.length - a.students.length ||
      a.name.localeCompare(b.name, "vi"),
  );
}

export function LearningSupportGroupPanel({
  examId,
  report,
}: {
  examId: string;
  report: SubjectSupportReport;
}) {
  const [objectives, setObjectives] = useState<LearningObjectiveEvidence[]>([]);
  const hasMaterial = report.materialContext?.available === true || objectives.some(
    (item) => item.granularity === "MATERIAL" && item.materialId,
  );
  const groups = useMemo(
    () => groupStudents(report.students, hasMaterial),
    [report.students, hasMaterial],
  );
  const [groupName, setGroupName] = useState("");
  const group = groups.find((item) => item.name === groupName) ?? groups[0];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<LearningPlanScopeItem[]>([]);
  const [plansError, setPlansError] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [criteria, setCriteria] = useState("");
  const [threshold, setThreshold] = useState(70);
  const [dueAt, setDueAt] = useState("");
  const [proposalReady, setProposalReady] = useState(false);
  const [materialProposals, setMaterialProposals] = useState<Record<string, MaterialPlanProposal>>({});
  const [busy, setBusy] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    cohortId: string;
    plans: LearningPlan[];
  } | null>(null);
  const [delivery, setDelivery] = useState<{
    published: string[];
    failed: Array<{ planId: string; studentId: string; reason: string }>;
  } | null>(null);

  useEffect(() => {
    setSelectedIds(group?.students.map((student) => student.id) ?? []);
    setObjectiveId("");
    setMaterialId("");
    setTitle("");
    setSummary("");
    setCriteria("");
    setThreshold(70);
    setDueAt("");
    setProposalReady(false);
    setPreparationProgress(0);
    setMaterialProposals({});
    setCreated(null);
    setDelivery(null);
  }, [group, report.version]);

  useEffect(() => {
    let active = true;
    void learningPlanService.listObjectives(examId)
      .then((loadedObjectives) => {
        if (!active) return;
        setObjectives(loadedObjectives);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải mục tiêu và tài liệu",
          );
      });
    return () => {
      active = false;
    };
  }, [
    examId,
    report.classId,
    report.subjectId,
  ]);

  useEffect(() => {
    let active = true;
    void learningPlanService
      .listForScope(report.classId, report.subjectId)
      .then((items) => {
        if (active) setPlans(items);
      })
      .catch((cause) => {
        if (active)
          setPlansError(
            cause instanceof Error ? cause.message : "Không thể tải lộ trình",
          );
      });
    return () => {
      active = false;
    };
  }, [report.classId, report.subjectId]);

  const materials = useMemo(
    () =>
      objectives
        .filter((item) => item.granularity === "MATERIAL" && item.materialId)
        .map((item) => ({
          id: item.materialId!,
          objectiveId: item.id,
          topicNames: item.topicNames ?? [],
          label: item.title,
        })),
    [objectives],
  );
  const topicObjectives = useMemo(
    () =>
      objectives.filter((item) => item.granularity === "TOPIC" && item.topicId),
    [objectives],
  );
  const materialObjectives = objectives.filter(
    (item) => item.granularity === "MATERIAL" && item.materialId,
  );
  const selectableObjectives = [...topicObjectives, ...materialObjectives];
  const unclassifiedCount = objectives.filter(
    (item) => item.granularity === "QUESTION",
  ).length;
  const chosenObjective = selectableObjectives.find(
    (item) => item.id === objectiveId,
  );

  useEffect(() => {
    if (!group || objectiveId) return;
    const matched = topicObjectives.find(
      (item) =>
        item.title.trim().toLocaleLowerCase("vi") ===
        group.name.trim().toLocaleLowerCase("vi"),
    );
    if (matched) setObjectiveId(matched.id);
  }, [group, objectiveId, topicObjectives]);

  const canSave = Boolean(
    group &&
    proposalReady &&
    selectedIds.length &&
    chosenObjective &&
    materialId &&
    title.trim() &&
    criteria.trim() &&
    (Number.isInteger(threshold) && threshold >= 0 && threshold <= 100) &&
    !busy,
  );

  async function suggestGroupPlan() {
    if (!group || !selectedIds.length || !chosenObjective || busy) return;
    setBusy(true);
    setError("");
    setCreated(null);
    setDelivery(null);
    setProposalReady(false);
    setPreparationProgress(0);
    try {
      const proposed: Record<string, MaterialPlanProposal> = {};
      if (chosenObjective.granularity === "MATERIAL" && chosenObjective.materialId) {
        for (const studentId of selectedIds) {
          try {
            proposed[studentId] = await learningPlanService.prepareMaterial(
              examId, studentId, chosenObjective.materialId,
            );
          } catch (cause) {
            const name = group.students.find((student) => student.id === studentId)?.fullName ?? studentId;
            throw new Error(`${name}: ${cause instanceof Error ? cause.message : "Không thể phân tích tài liệu"}`);
          }
          setPreparationProgress((current) => current + 1);
        }
        setMaterialProposals(proposed);
      }
      const ideas = chosenObjective.granularity === "MATERIAL" ? [] : await Promise.all(
        selectedIds.map((studentId) => learningPlanService.suggest(examId, studentId, chosenObjective.id)),
      );
      const evidence = [
        ...new Set(
          ideas
            .flatMap((idea) => [idea.summary, idea.evidence])
            .filter((item): item is string => Boolean(item?.trim()))
            .map((item) => item.trim()),
        ),
      ];
      const suggestedMaterial =
        materials.find((item) => item.id === chosenObjective.materialId) ??
        materials.find((item) => item.topicNames.includes(chosenObjective.title)) ??
        materials[0];
      setMaterialId(suggestedMaterial?.id ?? "");
      setTitle(`Ôn tập ${chosenObjective.title}`);
      setSummary(chosenObjective.granularity === "MATERIAL"
        ? `Ôn theo ${Object.values(proposed).reduce((sum, item) => sum + item.matchedCount, 0)} câu sai đã đối chiếu với ${chosenObjective.title} cho ${selectedIds.length} học sinh. Mỗi học sinh đọc đúng mục và làm bài luyện riêng; căn cứ chi tiết nằm trong hồ sơ cá nhân.`
        : `AI đề xuất cho ${selectedIds.length} học sinh cùng cần củng cố ${chosenObjective.title}.${
            evidence.length ? ` Căn cứ: ${evidence.join(" ")}` : ""
          }`);
      setCriteria(chosenObjective.granularity === "MATERIAL"
        ? `Đọc các mục được khoanh vùng, hoàn thành bài luyện riêng và đạt ít nhất 70%. Kết quả luyện tập được lưu theo từng lượt.`
        : `Hoàn thành tài liệu và đạt ít nhất 70% ở bài luyện, sau đó làm bài đánh giá lại cùng chủ đề.`);
      setThreshold(70);
      setProposalReady(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tạo đề xuất lộ trình cho nhóm",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveAndPublish() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    setCreated(null);
    setDelivery(null);
    try {
      const drafts = await learningPlanService.createDrafts(examId, {
        studentIds: selectedIds,
        objectiveId,
        ...(chosenObjective?.granularity === "MATERIAL"
          ? { materialPreparationIds: Object.fromEntries(Object.entries(materialProposals)
              .map(([studentId, proposal]) => [studentId, proposal.analysisId])) }
          : {}),
        title: title.trim(),
        summary: summary.trim(),
        successCriteria: criteria.trim(),
        targetAccuracyPercent: threshold,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        tasks: [
          {
            kind: "MATERIAL",
            title: `Đọc và ôn ${chosenObjective?.title ?? group?.name ?? "kiến thức"}`,
            description: chosenObjective?.granularity === "MATERIAL"
              ? "Đọc các mục theo trang, đối chiếu trích đoạn và câu sai của riêng học sinh."
              : "Đọc tài liệu đã gắn và chuẩn bị cho bài đánh giá lại.",
            materialId,
          },
          ...([{
            kind: "PRACTICE",
            title: `Luyện tập ${chosenObjective?.title ?? group?.name ?? "kiến thức"}`,
            description:
              "Mỗi học sinh làm bộ câu luyện riêng đúng mục tiêu kiến thức trước khi đánh giá lại.",
          } as const]),
        ],
      });
      setCreated(drafts);
      const createdAt = new Date().toISOString();
      const optimisticPlans: LearningPlanScopeItem[] = drafts.plans.map(
        (plan) => ({
          id: plan.id,
          cohortId: plan.cohortId,
          studentId: plan.studentId,
          title: plan.title,
          status: plan.status,
          createdAt,
        }),
      );
      setPlans((current) => [
        ...optimisticPlans,
        ...current.filter(
          (plan) =>
            !optimisticPlans.some((createdPlan) => createdPlan.id === plan.id),
        ),
      ]);
      const published = await learningPlanService.publishCohort(
        drafts.cohortId,
      );
      setDelivery(published);
      const publishedIds = new Set(published.published);
      const optimisticPublished = optimisticPlans.map((plan) => ({
        ...plan,
        status: publishedIds.has(plan.id) ? ("ASSIGNED" as const) : plan.status,
      }));
      setPlans((current) =>
        current.map((plan) =>
          publishedIds.has(plan.id)
            ? { ...plan, status: "ASSIGNED" as const }
            : plan,
        ),
      );
      try {
        const refreshed = await learningPlanService.listForScope(
          report.classId,
          report.subjectId,
        );
        setPlans([
          ...refreshed,
          ...optimisticPublished.filter(
            (plan) => !refreshed.some((item) => item.id === plan.id),
          ),
        ]);
      } catch {
        setPlansError(
          "Lộ trình đã được xử lý nhưng chưa tải lại được danh sách mới.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể duyệt và giao lộ trình cho nhóm",
      );
    } finally {
      setBusy(false);
    }
  }

  const cohorts = [
    ...new Map(
      plans.map((plan) => [
        plan.cohortId,
        plans.filter((item) => item.cohortId === plan.cohortId),
      ]),
    ).values(),
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-900">Nhóm cần hỗ trợ</h2>
          <p className="mt-1 text-sm text-slate-500">
            {hasMaterial
              ? "Gom theo chủ đề của câu làm sai hoặc bỏ trống. Một sinh viên có thể thuộc nhiều nhóm."
              : "Chỉ gom theo mức nguy cơ từ kết quả bài kiểm tra vì môn học chưa có tài liệu."}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {groups.length} nhóm
        </span>
      </div>
      {groups.length ? (
        <>
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Chọn nhóm kiến thức"
          >
            {groups.map((item) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={group?.name === item.name}
                onClick={() => setGroupName(item.name)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${group?.name === item.name ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {item.name}{" "}
                <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-xs">
                  {item.students.length}
                </span>
              </button>
            ))}
          </div>
          {group ? (
            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900">{group.name}</h3>
                <span className="text-xs text-slate-500">
                  Đã chọn {selectedIds.length}/{group.students.length} sinh viên
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.students.map((student) => (
                  <label
                    key={student.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${selectedIds.includes(student.id) ? "border-brand-200 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 rounded border-slate-300 accent-brand-600 focus:ring-2 focus:ring-blue-100"
                      checked={selectedIds.includes(student.id)}
                      onChange={(event) => {
                        setProposalReady(false);
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, student.id]
                            : current.filter((id) => id !== student.id),
                        );
                      }}
                    />
                    <span className="min-w-0 truncate">{student.fullName}</span>
                    <span
                      className={`ml-auto shrink-0 text-xs font-semibold ${student.level === "HIGH" ? "text-rose-700" : "text-amber-700"}`}
                    >
                      {student.level === "HIGH" ? "Ưu tiên" : "Theo dõi"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {hasMaterial ? (
            <details className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
              <summary className="cursor-pointer font-bold text-brand-800">
                AI đề xuất lộ trình cho nhóm đã chọn
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Chọn chủ đề để giao tài liệu, bài luyện và đánh giá lại; hoặc
                chọn tài liệu của môn để khoanh vùng mục cần ôn từ câu sai và tạo bài luyện riêng.
                Giáo viên kiểm tra, chỉnh sửa rồi mới duyệt giao.
              </p>
              {unclassifiedCount > 0 && materialObjectives.length === 0 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {unclassifiedCount} câu hỏi chưa gắn chủ đề nên chưa thể dùng
                  làm mục tiêu đánh giá chung. Hãy gắn chủ đề trong{" "}
                  <Link
                    href="/teacher/question-bank"
                    className="font-semibold underline"
                  >
                    Ngân hàng câu hỏi
                  </Link>
                  . Bài làm đã nộp có thể vẫn giữ chủ đề cũ.
                </p>
              ) : null}
              {topicObjectives.length === 0 ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  {materialObjectives.length
                    ? "Chưa có mục tiêu theo chủ đề. Chọn tài liệu để khoanh vùng câu sai và tạo lộ trình ôn tập cho nhóm."
                    : "Chưa có chủ đề hoặc tài liệu PDF sẵn sàng cho môn này."}
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <CustomSelect
                  label="Mục tiêu học tập (chủ đề hoặc tài liệu của môn)"
                  value={objectiveId}
                  options={selectableObjectives.map((objective) => ({
                    value: objective.id,
                    label: objective.granularity === "MATERIAL" ? `Tài liệu · ${objective.title}` : objective.title,
                  }))}
                  placeholder={
                    selectableObjectives.length
                      ? "Chọn chủ đề hoặc tài liệu của môn"
                      : "Chưa có chủ đề hoặc tài liệu"
                  }
                  onValueChange={(value) => {
                    setObjectiveId(value);
                    setProposalReady(false);
                  }}
                  disabled={selectableObjectives.length === 0}
                  ariaLabel="Chọn chủ đề hoặc tài liệu của môn"
                />
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={busy || !selectedIds.length || !chosenObjective}
                    onClick={() => void suggestGroupPlan()}
                  >
                    {busy ? chosenObjective?.granularity === "MATERIAL"
                      ? `Đang phân tích học sinh ${Math.min(preparationProgress + 1, selectedIds.length)}/${selectedIds.length}...`
                      : "AI đang tạo đề xuất..." : "Tạo đề xuất bằng AI"}
                  </Button>
                </div>
              </div>
              {chosenObjective?.granularity === "MATERIAL" ? (
                <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  {busy
                    ? "Đang đối chiếu câu sai với PDF, tạo câu luyện và kiểm tra đáp án theo từng mục. Tài liệu có nhiều mục có thể mất hơn một phút."
                    : "Hệ thống sẽ đối chiếu câu sai với tài liệu, gom theo trang khi tài liệu không có chương, trích nguồn và tạo bài luyện riêng cho từng học sinh."}
                </p>
              ) : null}
              {proposalReady ? (
                <>
                  <p
                    role="status"
                    className="mt-4 rounded-lg border border-blue-200 bg-white p-3 text-sm text-blue-800"
                  >
                    Đây là bản AI đề xuất xem trước, chưa phải lộ trình đã tạo.
                    Giáo viên có thể chỉnh sửa rồi duyệt để giao cho nhóm.
                  </p>
                  {chosenObjective?.granularity === "MATERIAL" ? (
                    <div className="mt-3 space-y-3">
                      {Object.entries(materialProposals).map(([studentId, proposal]) => (
                        <div key={studentId} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                          <p className="font-bold text-slate-900">
                            {group?.students.find((student) => student.id === studentId)?.fullName ?? studentId}
                            {" · "}{proposal.matchedCount}/{proposal.missedCount} câu sai từ {proposal.sourceExamCount ?? 1} bài kiểm tra có đoạn tài liệu phù hợp
                          </p>
                          <p className="mt-1 text-slate-600">Tỷ lệ đúng các bài kiểm tra nguồn: {proposal.baselineExamAccuracy === null ? "Chưa đủ dữ liệu" : `${proposal.baselineExamAccuracy}%`} · Bài luyện riêng đã tạo</p>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {proposal.sections.map((section) => (
                              <div key={section.id ?? section.title} className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                                <p className="font-bold text-brand-700">{section.title} · {section.missedCount} câu sai</p>
                                <p className="mt-1 text-slate-700">{section.theory}</p>
                                {section.mistakes?.slice(0, 2).map((mistake) => <div key={`${mistake.sourceAttemptId ?? ""}:${mistake.questionId}`} className="mt-2 rounded-md border border-amber-100 bg-amber-50/70 p-2 text-xs text-slate-700"><p className="font-semibold">Câu đã sai: {mistake.content}</p><p className="mt-1">Đã chọn: {mistake.selectedAnswer} · Đúng: {mistake.correctAnswer}</p></div>)}
                                {section.keyPoints.length ? <ul className="mt-2 list-disc pl-5 text-slate-600">{section.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}
                                {section.citations.slice(0, 2).map((citation, index) => <p key={index} className="mt-2 border-l-2 border-brand-300 pl-2 text-xs text-slate-500">{citation.documentName}, trang {citation.page}: {citation.excerpt}</p>)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <CustomSelect
                      label="Tài liệu đã gắn với môn"
                      value={materialId}
                      options={materials.map((material) => ({
                        value: material.id,
                        label: material.label,
                      }))}
                      placeholder="Chọn tài liệu"
                      onValueChange={setMaterialId}
                      disabled={chosenObjective?.granularity === "MATERIAL"}
                      ariaLabel="Chọn tài liệu đã gắn với môn"
                    />
                    <Input
                      label="Tên lộ trình"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={`Ôn tập ${group?.name ?? "chủ đề"}`}
                    />
                    <DateTimePicker
                      label="Hạn hoàn thành"
                      value={dueAt}
                      onChange={setDueAt}
                    />
                    <div className="md:col-span-2">
                      <Textarea
                        label="Mục đích và căn cứ"
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder="Giải thích vì sao nhóm này cần ôn tập"
                      />
                    </div>
                    <Textarea
                      label={chosenObjective?.granularity === "MATERIAL" ? "Tiêu chí hoàn thành" : "Tiêu chí đạt sau đánh giá lại"}
                      value={criteria}
                      onChange={(event) => setCriteria(event.target.value)}
                      placeholder="Điều kiện cụ thể để xác nhận tiến bộ"
                    />
                    {(
                      <Input
                        label="Ngưỡng đúng (%)"
                        type="number"
                        min="0"
                        max="100"
                        value={threshold}
                        onChange={(event) =>
                          setThreshold(Number(event.target.value))
                        }
                      />
                    )}
                  </div>
                </>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              {proposalReady ? (
                <Button
                  className="mt-4"
                  disabled={!canSave}
                  onClick={() => void approveAndPublish()}
                >
                  {busy
                    ? "Đang tạo và giao..."
                    : `Duyệt và giao cho ${selectedIds.length} học sinh`}
                </Button>
              ) : null}
              {created ? (
                <div
                  role="status"
                  className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  <p className="font-bold">
                    Đã tạo {created.plans.length} hồ sơ lộ trình cho nhóm.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {created.plans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/teacher/learning-plans/${plan.id}`}
                        className="rounded-lg bg-white px-2.5 py-1 font-semibold text-brand-700 hover:underline"
                      >
                        {group.students.find(
                          (student) => student.id === plan.studentId,
                        )?.fullName ?? plan.studentId}{" "}
                        →
                      </Link>
                    ))}
                  </div>
                  {delivery ? (
                    <div className="mt-3 rounded-lg bg-white p-3">
                      <p className="font-bold">
                        Đã giao {delivery.published.length} lộ trình;{" "}
                        {delivery.failed.length} cần xử lý thêm.
                      </p>
                      {delivery.failed.map((item) => (
                        <p key={item.planId} className="mt-1 text-amber-800">
                          <Link
                            href={`/teacher/learning-plans/${item.planId}`}
                            className="font-semibold underline"
                          >
                            {group.students.find(
                              (student) => student.id === item.studentId,
                            )?.fullName ?? item.studentId}
                          </Link>
                          : {item.reason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </details>
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Chưa có tài liệu được gắn và xử lý sẵn sàng; hiện chỉ theo dõi
              nguy cơ từ bài kiểm tra.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          Chưa có sinh viên được xếp mức cần hỗ trợ từ các bài kiểm tra.
        </p>
      )}
      <details className="group mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:content-none sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-700">
              <BookOpenCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900">
                Lộ trình đã tạo · {cohorts.length} đợt
              </h3>
              <p className="mt-0.5 text-xs font-normal text-slate-500">
                Theo dõi trạng thái giao bài và tiến độ của từng nhóm
              </p>
            </div>
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180">
            <ChevronDown className="size-4" />
          </span>
        </summary>
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-4 sm:px-5">
        {!cohorts.length && proposalReady ? (
          <p className="text-xs text-slate-500">
            Bản AI đề xuất phía trên chỉ là bản xem trước. Lộ trình sẽ xuất hiện
            ở đây sau khi giáo viên bấm “Duyệt và giao”.
          </p>
        ) : null}
        {plans.length === 200 ? (
          <p className="mb-3 text-xs text-slate-500">
            Đang hiển thị 200 lộ trình gần nhất.
          </p>
        ) : null}
        {plansError ? (
          <p role="alert" className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {plansError}
          </p>
        ) : null}
        {cohorts.length ? (
          <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {cohorts.map((cohort, index) => {
              const cohortId = cohort[0].cohortId;
              const draftCount = cohort.filter((plan) => plan.status === "DRAFT").length;
              const assignedCount = cohort.filter(
                (plan) => plan.status !== "DRAFT" && plan.status !== "CANCELLED",
              ).length;

              return (
                <article
                  key={cohortId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white shadow-sm shadow-blue-200">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-slate-900">
                          {cohort[0].title}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <UsersRound className="size-3.5" />
                            {cohort.length} sinh viên
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" />
                            Tạo lúc {formatCreatedAt(cohort[0].createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {draftCount} bản nháp · {assignedCount} đã giao
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/teacher/cohorts/${encodeURIComponent(cohortId)}`}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-brand-700 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
                    >
                      <Eye className="size-4" />
                      Xem chi tiết
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !plansError ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <BookOpenCheck className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có lộ trình cho môn này</p>
            <p className="mt-1 max-w-md text-xs text-slate-500">Lộ trình đã duyệt và giao cho sinh viên sẽ được lưu tại đây.</p>
          </div>
        ) : null}
        </div>
      </details>
    </section>
  );
}
