"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, BookOpen, Clock3, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { examService } from "@/lib/assessment-api";
import { studyActivityReviewSections } from "@/lib/study-activity-review";
import type {
  StudyActivityReview,
  StudyActivityDashboard,
  StudyPracticeAttempt,
} from "@/types/assessment";

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
  : "—";

const durationLabel = (seconds: number) => seconds < 60
  ? `${seconds} giây`
  : `${Math.floor(seconds / 60)} phút`;

export function TeacherStudyProgress({
  examId,
  studentId,
  attemptId,
}: {
  examId: string;
  studentId: string;
  attemptId: string;
}) {
  const [data, setData] = useState<StudyActivityDashboard | null>(null);
  const [error, setError] = useState("");
  const [practiceDetailId, setPracticeDetailId] = useState<string | null>(null);
  const [practiceDetail, setPracticeDetail] = useState<StudyPracticeAttempt | null>(null);
  const [practiceDetailError, setPracticeDetailError] = useState("");
  const [practiceDetailLoading, setPracticeDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let loading = false;
    setData(null);
    setError("");
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = await examService.getTeacherStudyActivity(examId, studentId, attemptId);
        if (active) {
          setData(value);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải tiến độ ôn tập");
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = globalThis.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible")
        void load();
    }, 10_000);
    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [examId, studentId, attemptId]);

  const analyses = data?.analysisHistory ?? [];
  const practiceActivity = data?.practice ?? [];
  const practices = practiceActivity.filter((item) => item.status === "SUBMITTED");
  const activePracticeCount = practiceActivity.length - practices.length;
  const views = data?.materialViews ?? [];
  const viewSeconds = views.reduce((total, view) => total + view.activeSeconds, 0);

  async function openPracticeDetail(practiceAttemptId: string) {
    setPracticeDetailId(practiceAttemptId);
    setPracticeDetail(null);
    setPracticeDetailError("");
    setPracticeDetailLoading(true);
    try {
      setPracticeDetail(
        await examService.getTeacherStudyPracticeAttempt(
          examId,
          studentId,
          attemptId,
          practiceAttemptId,
        ),
      );
    } catch (cause) {
      setPracticeDetailError(
        cause instanceof Error
          ? cause.message
          : "Không thể tải chi tiết bài luyện",
      );
    } finally {
      setPracticeDetailLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-black text-slate-900">
        <BarChart3 className="size-5 text-brand-600" /> Nhật ký phân tích và tự ôn tập
      </h3>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {!data && !error ? <p className="mt-4 text-sm text-slate-500">Đang tải lịch sử học tập...</p> : null}
      {data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Bài kiểm tra đã phân tích</p><p className="mt-1 text-2xl font-black">{analyses.length}</p></div>
            <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Lượt luyện đã nộp</p><p className="mt-1 text-2xl font-black">{practices.length}</p>{activePracticeCount ? <p className="mt-1 text-xs font-semibold text-amber-700">{activePracticeCount} lượt đang làm</p> : null}</div>
            <div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Thời gian xem tài liệu</p><p className="mt-1 text-2xl font-black">{viewSeconds ? durationLabel(viewSeconds) : "0 phút"}</p></div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="self-start rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="font-black">Lịch sử kết quả và phân tích AI</h4>
              <p className="mt-1 text-xs text-slate-500">Mỗi mốc là một bài kiểm tra đã lưu phân tích; điểm không thay đổi khi học sinh luyện.</p>
              <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                {analyses.map((item) => {
                  const percentage = item.score !== null && item.totalPoints
                    ? Math.round((item.score / item.totalPoints) * 100) : null;
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 ${item.attemptId === attemptId ? "border-brand-200 bg-blue-50/50" : "border-slate-100"}`}>
                      <div className="flex flex-wrap justify-between gap-1 text-sm">
                        <p className="font-bold text-slate-900">{item.examTitle}</p>
                        <span className="font-black text-brand-700">{item.score ?? "—"}/{item.totalPoints ?? "—"}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.aiStatus === "READY" ? "AI phân tích" : item.aiStatus === "FALLBACK" ? "Phân tích dự phòng" : "Thống kê bài làm"} {dateLabel(item.generatedAt)} · {item.weakAreaCount} nội dung cần xem lại
                      </p>
                      {percentage !== null ? <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div> : null}
                      {item.summary ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{item.summary}</p> : null}
                      {item.examId && item.attemptId && item.attemptId !== attemptId ? (
                        <Link href={`/teacher/exams/${item.examId}/submissions/${item.attemptId}`} className="mt-2 inline-block text-xs font-bold text-brand-700 underline">
                          Xem chi tiết bài làm
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
                {!analyses.length ? <p className="text-sm text-slate-500">Chưa có mốc phân tích được lưu.</p> : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="font-black">Quá trình luyện tập của bài này</h4>
              <p className="mt-1 text-xs text-slate-500">Điểm bài luyện phản ánh bộ câu luyện; chỉ đối chiếu xu hướng, không xem là điểm kiểm tra tương đương.</p>
              <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                {practices.map((item) => {
                  const percentage = item.totalQuestions ? Math.round((item.correctCount / item.totalQuestions) * 100) : 0;
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-bold">Lượt {item.attemptNumber} · {dateLabel(item.submittedAt)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-brand-700">{item.correctCount}/{item.totalQuestions}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 px-2.5 text-xs"
                            onClick={() => void openPracticeDetail(item.id)}
                          >
                            <Eye className="size-3.5" /> Xem chi tiết
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${percentage >= 80 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${percentage}%` }} /></div>
                      <p className="mt-1 text-xs text-slate-500">Làm trong {durationLabel(item.durationSeconds)} · {item.assistance === "SYSTEM_HINTS_USED" ? "Có dùng gợi ý" : item.assistance === "NO_SYSTEM_HINTS" ? "Không dùng gợi ý hệ thống" : "Chưa rõ hỗ trợ"}</p>
                    </div>
                  );
                })}
                {!practices.length ? <p className="text-sm text-slate-500">Học sinh chưa nộp bài luyện của phần này.</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="flex items-center gap-2 font-black"><BookOpen className="size-4 text-brand-600" /> Lịch sử xem tài liệu của bài này</h4>
            <p className="mt-1 text-xs text-slate-500">Thời gian chỉ ghi nhận bản xem trước được mở từ trang ôn tập cá nhân và tab đang hiển thị.</p>
            {views.length ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {views.map((view) => <div key={view.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-bold">{view.materialName}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="size-3.5" /> {dateLabel(view.openedAt)} · {durationLabel(view.activeSeconds)}</p></div>)}
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">Chưa ghi nhận lượt xem tài liệu từ trang ôn tập này.</p>}
          </div>

          <div className="mt-4">
            <TeacherStudyProgressFeedback
              data={data}
              examId={examId}
              studentId={studentId}
              attemptId={attemptId}
            />
          </div>
        </>
      ) : null}
      <Modal
        open={practiceDetailId !== null}
        title={
          practiceDetail
            ? `Chi tiết bài luyện ${practiceDetail.attemptNumber}`
            : "Chi tiết bài luyện"
        }
        description="Câu hỏi, đáp án và kết quả được giữ theo đúng thời điểm học sinh nộp bài."
        width="max-w-4xl"
        bodyClassName="max-h-[78vh] overflow-y-auto"
        onClose={() => {
          setPracticeDetailId(null);
          setPracticeDetail(null);
          setPracticeDetailError("");
        }}
      >
        {practiceDetailLoading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Đang tải chi tiết bài luyện...
          </p>
        ) : practiceDetailError ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            {practiceDetailError}
          </p>
        ) : practiceDetail ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs font-bold text-slate-500">Kết quả</p>
                <p className="mt-1 text-xl font-black text-brand-700">
                  {practiceDetail.correctCount}/{practiceDetail.totalQuestions}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">Thời gian</p>
                <p className="mt-1 font-black text-slate-900">
                  {durationLabel(practiceDetail.durationSeconds ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">Hỗ trợ</p>
                <p className="mt-1 font-black text-slate-900">
                  {practiceDetail.assistance === "SYSTEM_HINTS_USED"
                    ? "Có dùng gợi ý"
                    : practiceDetail.assistance === "NO_SYSTEM_HINTS"
                      ? "Không dùng gợi ý hệ thống"
                      : "Chưa rõ hỗ trợ"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {practiceDetail.questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-brand-700">
                        Câu {index + 1} · {question.topicName}
                      </p>
                      <p className="mt-1 font-bold leading-6 text-slate-900">
                        {question.content}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${question.correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {question.correct ? "Đúng" : "Chưa đúng"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => {
                      const chosen = question.selectedOptionIds?.includes(option.id);
                      const correct = question.correctOptionIds?.includes(option.id);
                      return (
                        <div
                          key={option.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${correct ? "border-emerald-300 bg-emerald-50 text-emerald-800" : chosen ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-600"}`}
                        >
                          <span className="mr-1 font-black">{option.label}.</span>
                          {option.text}
                          {chosen ? " · Học sinh chọn" : ""}
                          {correct ? " · Đáp án đúng" : ""}
                        </div>
                      );
                    })}
                  </div>
                  {question.explanation ? (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                      <span className="font-black text-slate-900">Giải thích: </span>
                      {question.explanation}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function TeacherStudyProgressFeedback({
  data,
  examId,
  studentId,
  attemptId,
}: {
  data: StudyActivityDashboard | null;
  examId: string;
  studentId: string;
  attemptId: string;
}) {
  const [generatedReview, setGeneratedReview] = useState<StudyActivityReview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const review = generatedReview ?? data?.activityReview;

  useEffect(() => {
    setGeneratedReview(null);
    setGenerateError("");
  }, [data?.activityReview?.generatedAt, attemptId]);

  async function regenerate() {
    setGenerating(true);
    setGenerateError("");
    try {
      setGeneratedReview(
        await examService.regenerateTeacherStudyActivityReview(
          examId,
          studentId,
          attemptId,
        ),
      );
    } catch (cause) {
      setGenerateError(
        cause instanceof Error
          ? cause.message
          : "Không thể tạo nhận xét AI",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="flex items-center gap-2 font-black text-slate-900">
        <Sparkles className="size-4 text-violet-600" /> Nhận xét AI về quá trình ôn tập
      </h4>
      {!data ? (
        <p className="mt-2 text-sm text-slate-500">Đang tạo nhận xét từ hoạt động ôn tập...</p>
      ) : review?.source === "AI" && review.comment ? (
        <div className="mt-2">
          <div className="grid gap-2 md:grid-cols-3">
            {studyActivityReviewSections(review.comment).map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                <p className={`text-xs font-black uppercase tracking-wide ${item.tone}`}>
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-700">{item.content}</p>
              </div>
            ))}
          </div>
          {review.generatedAt ? (
            <p className="mt-1.5 text-xs text-slate-500">
              AI cập nhật lúc {dateLabel(review.generatedAt)} khi có hoạt động ôn tập mới.
            </p>
          ) : null}
        </div>
      ) : review?.source === "ERROR" ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-700">
            Chưa thể tạo nhận xét AI. Bạn có thể yêu cầu hệ thống thử lại ngay.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={generating}
            onClick={() => void regenerate()}
          >
            {generating ? "Đang tạo nhận xét..." : "Tạo lại nhận xét AI"}
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Chưa có đủ hoạt động đọc tài liệu hoặc làm bài luyện để AI nhận xét.
        </p>
      )}
      {generateError ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {generateError}
        </p>
      ) : null}
    </section>
  );
}
