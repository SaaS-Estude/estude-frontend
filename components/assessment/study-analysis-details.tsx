"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CheckCircle2,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  StudyAiFeedback,
  StudyAnalysisReport,
  StudyLearningPath,
  StudySourceType,
} from "@/types/assessment";

export const sourceMeta: Record<
  StudySourceType,
  { label: string; description: string; tone: string }
> = {
  SOURCE_UNAVAILABLE: {
    label: "Chưa kiểm tra được nguồn",
    description:
      "Tài liệu chưa truy xuất được; chưa đủ căn cứ để kết luận nội dung nằm ngoài tài liệu.",
    tone: "bg-slate-100 text-slate-700",
  },
  COURSE_MATERIAL: {
    label: "Trong tài liệu môn học",
    description: "Được đối chiếu với tài liệu giáo viên đã gán cho lớp.",
    tone: "bg-emerald-50 text-emerald-700",
  },
  EXTERNAL_KNOWLEDGE: {
    label: "Kiến thức bổ sung",
    description: "Chưa tìm thấy nội dung tương ứng rõ ràng trong tài liệu lớp.",
    tone: "bg-amber-50 text-amber-700",
  },
};

export function StudyAnalysisDetails({
  report,
  onFeedback,
}: {
  report: StudyAnalysisReport;
  onFeedback?: (
    targetKey: string,
    reason: StudyAiFeedback["reason"],
    comment: string,
  ) => Promise<void>;
}) {
  const assessmentOnly =
    report.analysisScope === "ASSESSMENT_ONLY" ||
    report.aiStatus === "SKIPPED_NO_MATERIAL";
  const classifiedLearningProfile = (report.learningProfile ?? []).filter(
    (topic) => topic.topicName !== "Kiến thức tổng hợp",
  );
  return (
    <>
      {classifiedLearningProfile.length ? (
        <details className="group mt-5 rounded-2xl border border-blue-100 bg-white shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 marker:content-none">
            <div>
              <h2 className="font-black">
                {assessmentOnly
                  ? "Ước lượng từ kết quả kiểm tra"
                  : "Hồ sơ học tập cá nhân"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {classifiedLearningProfile.length} chủ đề · Bấm để xem mức nắm
                vững
              </p>
            </div>
            <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500">
              Dựa trên bài này và {report.historyAnalysisCount ?? 0} bài đã được
              phân tích trước đó cùng môn/lớp.{" "}
              {assessmentOnly
                ? "Mức nắm vững chỉ là chỉ báo nguy cơ, không phải xếp loại học lực chính thức."
                : "Mức nắm vững là ước lượng để chọn bài ôn, không phải điểm kiểm tra."}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {classifiedLearningProfile.map((topic) => (
                <div
                  key={topic.objectiveId ?? topic.topicName}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-bold">{topic.topicName}</h3>
                    <span className="font-bold text-blue-700">
                      {topic.masteryEstimate}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {topic.sampleSize} câu quan sát ·{" "}
                    {topic.evidenceLevel === "LIMITED"
                      ? "Cần thêm dữ liệu"
                      : topic.trend === "IMPROVING"
                        ? "Đang tiến bộ"
                        : topic.trend === "DECLINING"
                          ? "Cần củng cố lại"
                          : topic.trend === "STABLE"
                            ? "Tương đối ổn định"
                            : "Chưa đủ dữ liệu so sánh"}
                  </p>
                  {!assessmentOnly ? (
                    <>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {topic.recommendation}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-blue-700">
                        Mức luyện đề xuất:{" "}
                        {topic.recommendedDifficulty === "EASY"
                          ? "Nền tảng"
                          : topic.recommendedDifficulty === "MEDIUM"
                            ? "Vận dụng"
                            : "Nâng cao"}
                      </p>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </details>
      ) : null}
      {!assessmentOnly ? (
        <LearningPathSection learningPath={report.learningPath} />
      ) : null}

      {!assessmentOnly ? (
        <details className="group mt-5 rounded-2xl border border-slate-200 bg-white shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 marker:content-none sm:p-6">
            <div>
              <h2 className="font-black">Nội dung cần ôn lại</h2>
              <p className="mt-1 text-sm text-slate-500">
                {report.weakAreas.length} nội dung · Bấm để xem nhận định và
                nguồn
              </p>
            </div>
            <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-5 sm:p-6">
            {report.weakAreas.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
                <h3 className="mt-3 font-black text-emerald-800">
                  Chưa phát hiện lỗ hổng kiến thức
                </h3>
                <p className="mt-1 text-sm text-emerald-700">
                  Bạn đã trả lời đúng toàn bộ câu hỏi có thể chấm tự động.
                </p>
              </div>
            ) : (
              report.weakAreas.map((area) => {
                const meta = sourceMeta[area.sourceType];
                return (
                  <article
                    key={area.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${meta.tone}`}
                        >
                          {meta.label}
                        </span>
                        <h3 className="mt-3 text-lg font-black">
                          {area.topicName}
                        </h3>
                      </div>
                      <span className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        Sai {area.missedCount}/{area.totalQuestions} câu
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">
                      {area.diagnosis}
                    </p>
                    <ReviewLabel
                      state={report.reviewStates?.[`AREA:${area.id}:DIAGNOSIS`]}
                    />
                    <FeedbackControl
                      onSend={
                        onFeedback
                          ? (reason, comment) =>
                              onFeedback(
                                `AREA:${area.id}:DIAGNOSIS`,
                                reason,
                                comment,
                              )
                          : undefined
                      }
                    />
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                        <Lightbulb className="size-4 text-amber-500" /> Gợi ý ôn
                        tập
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {area.reviewSummary}
                      </p>
                      <ReviewLabel
                        state={report.reviewStates?.[`AREA:${area.id}:REVIEW`]}
                      />
                      <FeedbackControl
                        onSend={
                          onFeedback
                            ? (reason, comment) =>
                                onFeedback(
                                  `AREA:${area.id}:REVIEW`,
                                  reason,
                                  comment,
                                )
                            : undefined
                        }
                      />
                      {area.keyPoints.length ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-600">
                          {area.keyPoints.map((point) => (
                            <li key={point} className="flex gap-2">
                              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {area.sourceReferences.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {area.sourceReferences.map((source) => (
                          <span
                            key={`${source.documentName}-${source.page}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"
                          >
                            <BookOpen className="size-3.5" />{" "}
                            {source.documentName} · trang {source.page}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs font-medium text-amber-700">
                        {meta.description}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function ReviewLabel({
  state,
}: {
  state?: {
    decision: "CONFIRMED" | "EDITED" | "REJECTED";
    version: number;
    reason: string;
  };
}) {
  return (
    <p className="mt-2 text-xs font-semibold text-blue-700">
      {!state
        ? "AI đề xuất · chưa được giáo viên xác nhận"
        : state.decision === "CONFIRMED"
          ? "Giáo viên đã xác nhận"
          : state.decision === "EDITED"
            ? `Giáo viên đã sửa · ${state.reason}`
            : `Giáo viên đã bác bỏ · ${state.reason}`}
    </p>
  );
}

export function FeedbackControl({
  onSend,
}: {
  onSend?: (
    reason: StudyAiFeedback["reason"],
    comment: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<StudyAiFeedback["reason"]>("UNCLEAR");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!onSend) return null;
  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        className="font-semibold text-brand-700 underline"
        onClick={() => setOpen(!open)}
      >
        Báo nhận định chưa đúng/rõ
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="rounded-lg border p-2"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as StudyAiFeedback["reason"])
            }
          >
            <option value="WRONG_KNOWLEDGE">Sai kiến thức</option>
            <option value="OUT_OF_SCOPE">Ngoài phạm vi</option>
            <option value="INSUFFICIENT_EVIDENCE">Thiếu bằng chứng</option>
            <option value="UNCLEAR">Chưa rõ</option>
          </select>
          <input
            className="min-w-40 flex-1 rounded-lg border p-2"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Ghi chú thêm"
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void onSend(reason, comment)
                .then(() => {
                  setOpen(false);
                  setComment("");
                })
                .catch((cause) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Không thể gửi phản hồi",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            Gửi
          </Button>
          {error ? (
            <p role="alert" className="w-full text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LearningPathSection({
  learningPath,
}: {
  learningPath: StudyLearningPath;
}) {
  return (
    <details className="group mt-5 rounded-2xl border border-slate-200 bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 marker:content-none sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <ListChecks className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">
              Gợi ý ôn tập
            </p>
            <h2 className="mt-1 text-xl font-black">
              Học sinh nên làm gì tiếp theo?
            </h2>
          </div>
        </div>
        <ChevronDown className="mt-2 size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <ol className="space-y-3 border-t border-slate-100 p-5 sm:p-6">
        {learningPath.steps.map((step) => (
          <li
            key={`${step.order}-${step.topicName}`}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white">
                {step.order}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-brand-600">
                  {step.topicName}
                </p>
                <h3 className="mt-1 font-black text-slate-900">{step.title}</h3>
              </div>
              <span className="ml-auto shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                {step.durationMinutes} phút
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                Mục tiêu
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                {step.objective}
              </p>
            </div>
            <div className="mt-3 rounded-xl bg-emerald-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                Cần hoàn thành
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                {step.activities.map((activity) => (
                  <li key={activity} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />
                    <span>{activity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
