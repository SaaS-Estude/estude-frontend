"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { examService } from "@/lib/assessment-api";
import { ApiError } from "@/lib/auth-api";
import type {
  AssessmentEvidenceRecord,
  LearningPlan,
  StudyEvidenceBundle,
} from "@/types/assessment";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
const difficultyLabel: Record<string, string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
};

function resultLabel(evidence: AssessmentEvidenceRecord) {
  return `Đúng ${evidence.correctCount} trên ${evidence.scorableCount} câu${evidence.accuracy === null ? "" : ` (${evidence.accuracy}%)`}`;
}

function EvidenceQuestions({
  evidence,
}: {
  evidence: AssessmentEvidenceRecord;
}) {
  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-bold text-brand-700">
        Xem câu hỏi và bài làm của học sinh
      </summary>
      <div className="mt-3 space-y-3">
        {evidence.questionSnapshot.map((question, index) => {
          const answer = evidence.answers.find(
            (item) => item.questionId === question.questionId,
          );
          return (
            <div
              key={question.questionId}
              className="rounded-lg bg-slate-50 p-3 text-sm"
            >
              <p className="font-bold">
                Câu {index + 1}: {question.content}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Mức độ:{" "}
                {difficultyLabel[question.difficulty] ?? question.difficulty} ·{" "}
                {question.points} điểm
              </p>
              {question.imageUrl ? (
                <a
                  href={question.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-brand-700 underline"
                >
                  Mở ảnh câu hỏi
                </a>
              ) : null}
              {question.type === "ESSAY" ? (
                <p className="mt-2 whitespace-pre-wrap">
                  Học sinh trả lời: {answer?.essayText || "Bỏ trống"} · Câu tự
                  luận chưa được chấm tự động
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="font-medium">
                    Học sinh chọn:{" "}
                    {answer?.selectedOptionIds.length
                      ? question.options
                          .filter((option) =>
                            answer.selectedOptionIds.includes(option.id),
                          )
                          .map((option) => option.label)
                          .join(", ") || "Không xác định"
                      : "Chưa chọn đáp án"}
                  </p>
                  {question.options.map((option) => {
                    const chosen = answer?.selectedOptionIds.includes(
                      option.id,
                    );
                    const correct = question.correctOptionIds.includes(
                      option.id,
                    );
                    return (
                      <p
                        key={option.id}
                        className={
                          correct
                            ? "text-emerald-700"
                            : chosen
                              ? "text-rose-700"
                              : "text-slate-600"
                        }
                      >
                        {option.label}. {option.text}
                        {chosen ? " · học sinh chọn" : ""}
                        {correct ? " · đáp án đúng" : ""}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export function StudyEvidencePanel({
  examId,
  studentId,
  plans = [],
}: {
  examId: string;
  studentId: string;
  plans?: LearningPlan[];
}) {
  const [bundle, setBundle] = useState<StudyEvidenceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setBundle(null);
    setCandidateId(null);
    void examService
      .getStudentEvidenceBundle(examId, studentId)
      .then((value) => {
        if (active) setBundle(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải bằng chứng",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, studentId]);

  const groups = useMemo(() => {
    const grouped = new Map<string, AssessmentEvidenceRecord[]>();
    for (const item of bundle?.items ?? []) {
      const isUngroupedQuestion =
        item.objective?.granularity === "QUESTION" ||
        item.objective?.key.startsWith("question:");
      if (isUngroupedQuestion) continue;
      grouped.set(item.objectiveId, [
        ...(grouped.get(item.objectiveId) ?? []),
        item,
      ]);
    }
    return [...grouped.entries()];
  }, [bundle]);
  const hasUngroupedQuestions = useMemo(
    () =>
      (bundle?.items ?? []).some(
        (item) =>
          item.objective?.granularity === "QUESTION" ||
          item.objective?.key.startsWith("question:"),
      ),
    [bundle],
  );

  async function saveBaseline(evidence: AssessmentEvidenceRecord) {
    if (!bundle || !reason.trim()) return;
    setSaving(true);
    setError("");
    try {
      const current = bundle.baselines.find(
        (item) => item.objectiveId === evidence.objectiveId,
      );
      await examService.selectStudentBaselineRecord(examId, studentId, {
        evidenceId: evidence.id,
        reason: reason.trim(),
        expectedVersion: current?.version ?? 0,
      });
      setBundle(await examService.getStudentEvidenceBundle(examId, studentId));
      setCandidateId(null);
      setReason("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể xác nhận mốc ban đầu",
      );
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          setBundle(await examService.getStudentEvidenceBundle(examId, studentId));
        } catch {
          /* Keep the conflict visible. */
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-black text-slate-900">
        Theo dõi tiến bộ sau ôn tập
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Dùng để kiểm tra sau khi ôn, học sinh có làm tốt hơn và đạt yêu cầu hay
        không.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Đang tải bằng chứng...</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}
      {bundle?.missingSnapshotAttemptIds.length ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Có {bundle.missingSnapshotAttemptIds.length} bài làm cũ không còn lưu
          đủ nội dung câu hỏi. Chưa thể dùng các bài này để đối chiếu.
        </p>
      ) : null}
      {!loading && bundle && !groups.length ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          {hasUngroupedQuestions
            ? "Chưa thể theo dõi tiến bộ vì các câu hỏi chưa được phân loại chủ đề. Hãy xác nhận chủ đề ở phần Phân loại chủ đề từ tài liệu trước."
            : "Chưa có bài làm phù hợp để theo dõi tiến bộ."}
        </p>
      ) : null}
      <div className="mt-4 space-y-5">
        {groups.map(([objectiveId, items]) => {
          const baseline = bundle?.baselines.find(
            (item) => item.objectiveId === objectiveId,
          );
          const history =
            bundle?.baselineHistory.filter(
              (item) => item.selectionId === baseline?.id,
            ) ?? [];
          const baselineEvidence = items.find(
            (item) => item.id === baseline?.evidenceId,
          );
          const activePlan =
            plans.find(
              (plan) =>
                plan.objectiveId === objectiveId && plan.status !== "CANCELLED",
            ) ?? plans.find((plan) => plan.objectiveId === objectiveId);
          return (
            <div
              key={objectiveId}
              className="rounded-xl border border-slate-200 p-4"
            >
              <h3 className="font-black">
                {items[0].objective?.title || "Chưa có tên chủ đề"}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    1. Kết quả hiện tại
                  </p>
                  <p className="mt-1 font-black text-slate-900">
                    {baselineEvidence
                      ? resultLabel(baselineEvidence)
                      : "Chưa chọn kết quả"}
                  </p>
                  {baseline ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {baseline.reason}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-400">
                    2. Mức cần đạt sau ôn
                  </p>
                  <p className="mt-1 font-black text-blue-800">
                    {activePlan?.targetAccuracyPercent !== null &&
                    activePlan?.targetAccuracyPercent !== undefined
                      ? `Ít nhất ${activePlan.targetAccuracyPercent}%`
                      : "Chưa đặt mục tiêu"}
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    {activePlan?.successCriteria ||
                      "Đặt trong mục “Giao nhiệm vụ cho học sinh này” ở phía trên."}
                  </p>
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-brand-700">
                  Chọn kết quả hiện tại từ bài đã làm ({items.length})
                </summary>
                <div className="space-y-3 border-t border-slate-100 p-3">
                  {items.map((evidence) => (
                    <article
                      key={evidence.id}
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">
                            {evidence.source === "ASSIGNED_EXAM"
                              ? "Bài kiểm tra"
                              : "Bài luyện tập"}{" "}
                            · {evidence.sourceTitle}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            Kết quả trong mục này: {resultLabel(evidence)} ·{" "}
                            {evidence.gradingStatus === "COMPLETE"
                              ? "Đã có kết quả"
                              : "Chưa chấm xong"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Nộp lúc {formatDate(evidence.observedAt)} ·{" "}
                            {evidence.assistance === "SYSTEM_HINTS_USED"
                              ? "Có dùng gợi ý"
                              : evidence.assistance === "NO_SYSTEM_HINTS"
                                ? "Không dùng gợi ý hệ thống"
                                : "Chưa rõ có dùng gợi ý không"}
                          </p>
                        </div>
                        {baseline?.evidenceId === evidence.id ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                            Bài đã chọn để so sánh
                          </span>
                        ) : null}
                      </div>
                      {evidence.source === "ASSIGNED_EXAM" ? (
                        <Link
                          href={`/teacher/exams/${evidence.examId}/submissions/${evidence.sourceAttemptId}`}
                          className="mt-2 inline-block text-sm font-semibold text-brand-700 underline"
                        >
                          Xem toàn bộ bài làm
                        </Link>
                      ) : null}
                      <EvidenceQuestions evidence={evidence} />
                      {evidence.scorableCount < 2 ? (
                        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          Riêng chủ đề này có ít hơn 2 câu đã chấm, dù toàn bài
                          có thể có nhiều câu hơn. Để đánh giá tiến bộ theo chủ
                          đề, hãy chọn kết quả có ít nhất 2 câu đã chấm thuộc
                          cùng chủ đề.
                        </p>
                      ) : null}
                      <details className="mt-3 text-xs text-slate-500">
                        <summary className="cursor-pointer">
                          Thông tin kỹ thuật
                        </summary>
                        <p className="mt-1 break-all">
                          Mã mục tiêu:{" "}
                          {evidence.objective?.key ?? evidence.objectiveId} ·
                          Quy tắc chấm: {evidence.gradingVersion}
                        </p>
                      </details>
                      {evidence.baselineEligible ? (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCandidateId(
                                candidateId === evidence.id
                                  ? null
                                  : evidence.id,
                              );
                              setReason("");
                            }}
                          >
                            Chọn làm kết quả hiện tại
                          </Button>
                          {candidateId === evidence.id ? (
                            <div className="mt-3 space-y-2">
                              <label
                                htmlFor={`baseline-reason-${evidence.id}`}
                                className="block text-sm font-semibold"
                              >
                                Vì sao chọn kết quả này để so sánh sau khi ôn?
                              </label>
                              <textarea
                                id={`baseline-reason-${evidence.id}`}
                                className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm"
                                value={reason}
                                maxLength={2000}
                                onChange={(event) =>
                                  setReason(event.target.value)
                                }
                              />
                              <Button
                                size="sm"
                                disabled={saving || !reason.trim()}
                                onClick={() => void saveBaseline(evidence)}
                              >
                                {saving
                                  ? "Đang lưu..."
                                  : "Xác nhận lưu kết quả"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-amber-700">
                          Không thể dùng bài này để so sánh:{" "}
                          {evidence.ineligibleReason}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {history.length ? (
                  <details className="m-3 text-xs text-slate-600">
                    <summary className="cursor-pointer font-semibold">
                      Các lần đổi kết quả hiện tại ({history.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {history.map((item) => (
                        <li key={`${item.selectionId}-${item.version}`}>
                          {formatDate(item.selectedAt)} · {item.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}
