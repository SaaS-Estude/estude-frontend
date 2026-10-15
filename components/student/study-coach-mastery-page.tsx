"use client";

import {
  ArrowLeft,
  CircleHelp,
  LoaderCircle,
  RotateCcw,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import {
  masteryLabels,
  masteryTones,
  studentError,
} from "@/lib/study-coach-view";
import type {
  ConceptMasteryState,
  ConceptMasteryView,
  StudyCoachLearningActivity,
} from "@/types/study-coach";

const EMPTY_ACTIVITY: StudyCoachLearningActivity = {
  flashcardReviewCount: 0,
  quizAnswerCount: 0,
  flashcardSessionCount: 0,
  quizCompletionCount: 0,
  totalCompletedSessions: 0,
  totalActivityCount: 0,
};

const filters: Array<{ value: ConceptMasteryState | "ALL"; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "STRONG", label: "Nắm rất vững" },
  { value: "PROFICIENT", label: "Nắm vững" },
  { value: "DEVELOPING", label: "Đang tiến bộ" },
  { value: "NEEDS_SUPPORT", label: "Cần ôn lại" },
  { value: "NEW", label: "Chưa đủ dữ liệu" },
];

export function StudyCoachMasteryPage() {
  const router = useRouter();
  const { materialId: documentId } = useParams<{ materialId: string }>();
  const [documentTitle, setDocumentTitle] = useState("");
  const [filter, setFilter] = useState<ConceptMasteryState | "ALL">("ALL");
  const [items, setItems] = useState<ConceptMasteryView[]>([]);
  const [activity, setActivity] = useState<StudyCoachLearningActivity>(EMPTY_ACTIVITY);
  const [minimumEvidence, setMinimumEvidence] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!documentId) {
      setItems([]);
      setActivity(EMPTY_ACTIVITY);
      setDocumentTitle("");
      setLoading(false);
      return;
    }
    try {
      const [result, material] = await Promise.all([
        studyCoachService.getMastery({ documentId }),
        studyCoachService.getMaterial(documentId).catch(() => null),
      ]);
      setItems(result.items);
      setActivity(result.activity ?? EMPTY_ACTIVITY);
      setMinimumEvidence(Math.max(1, result.policy?.minimumEvidenceRequired ?? 3));
      setDocumentTitle(material?.title ?? "");
    } catch (cause) {
      setError(studentError(cause, "Không thể tải tiến độ học tập."));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(
    () => filter === "ALL" ? items : items.filter((item) => item.state === filter),
    [filter, items],
  );
  const totalEvidence = items.reduce((sum, item) => sum + item.correctEvidence + item.incorrectEvidence, 0);
  const correctEvidence = items.reduce((sum, item) => sum + item.correctEvidence, 0);
  const quizAccuracy = totalEvidence > 0 ? Math.round((correctEvidence / totalEvidence) * 100) : null;
  const backHref = `/student/study-coach/materials/${encodeURIComponent(documentId)}`;
  const quizHref = `/student/study-coach/materials/${encodeURIComponent(documentId)}/quiz`;

  return (
    <StudentShell>
      <div data-testid="mastery-overview">
        <header className="rounded-3xl bg-gradient-to-br from-brand-700 to-blue-500 p-6 text-white shadow-card sm:p-8">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300/40"
          >
            <ArrowLeft className="size-4" /> Quay lại tài liệu
          </button>
          <p className="mt-4 text-xs font-black uppercase tracking-wider text-blue-100">Tiến độ của bạn</p>
          <h1 className="mt-1 text-3xl font-black">Mức độ nắm vững kiến thức</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
            {documentTitle
              ? `Kết quả học với tài liệu “${documentTitle}”.`
              : "Xem kết quả bài luyện và mức độ nắm vững theo từng khái niệm."}
          </p>
        </header>

        {loading ? (
          <LoadingPanel />
        ) : error ? (
          <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => void load()}>
              <RotateCcw className="size-4" /> Thử lại
            </Button>
          </section>
        ) : !documentId ? (
          <section className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <div>
              <Target className="mx-auto size-8 text-brand-500" />
              <h2 className="mt-4 text-lg font-black text-slate-950">Chọn tài liệu để xem năng lực</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Năng lực được theo dõi riêng cho từng tài liệu để kết quả không bị trộn lẫn.</p>
              <Button className="mt-5" onClick={() => router.push("/student/study-coach#mastery-by-document")}>Xem danh sách tài liệu</Button>
            </div>
          </section>
        ) : (
          <>
            <ProgressDashboard items={items} accuracy={quizAccuracy} activity={activity} minimumEvidence={minimumEvidence} />

            <section className="mt-6">
              <div className="mb-4"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Chi tiết theo nội dung</p><h2 className="mt-1 text-xl font-black text-slate-950">Tiến độ từng khái niệm</h2><p className="mt-1 text-sm text-slate-500">So sánh kết quả, mức nắm vững và việc nên làm tiếp trên cùng một dòng.</p></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo mức độ nắm vững">
                {filters.map((item) => {
                  const count = item.value === "ALL"
                    ? items.length
                    : items.filter((concept) => concept.state === item.value).length;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={filter === item.value}
                      onClick={() => setFilter(item.value)}
                      className={`min-h-11 rounded-full border px-4 text-sm font-black focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                        filter === item.value
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {item.label} <span className="ml-1 opacity-75">{count}</span>
                    </button>
                  );
                })}
              </div>

              {visibleItems.length ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                  <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(160px,0.9fr)_minmax(190px,1fr)_minmax(190px,1fr)] gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 lg:grid">
                    <span>Khái niệm</span><span>Kết quả bài luyện</span><span>Mức nắm vững</span><span>Gợi ý luyện tiếp</span>
                  </div>
                  {visibleItems.map((item) => (
                    <ConceptProgressRow key={item.conceptId} item={item} minimumEvidence={minimumEvidence} />
                  ))}
                </div>
              ) : (
                <EmptyFilter
                  filter={filter}
                  hasConcepts={items.length > 0}
                  onPractice={() => router.push(quizHref)}
                />
              )}
            </section>
          </>
        )}
      </div>
    </StudentShell>
  );
}

const chartColors: Record<ConceptMasteryState, string> = {
  STRONG: "bg-emerald-500",
  PROFICIENT: "bg-blue-500",
  DEVELOPING: "bg-amber-400",
  NEEDS_SUPPORT: "bg-rose-500",
  NEW: "bg-slate-300",
};

function ProgressDashboard({ items, accuracy, activity, minimumEvidence }: { items: ConceptMasteryView[]; accuracy: number | null; activity: StudyCoachLearningActivity; minimumEvidence: number }) {
  const distribution = filters.filter((item): item is { value: ConceptMasteryState; label: string } => item.value !== "ALL").map((item) => ({ ...item, count: items.filter((concept) => concept.state === item.value).length }));
  const evaluatedCount = items.filter((item) => item.evidenceCount > 0).length;
  const classifiedCount = items.filter((item) => item.state !== "NEW").length;
  const completed = activity.totalCompletedSessions ?? activity.totalActivityCount;
  return <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card" aria-label="Biểu đồ năng lực">
    <div className="grid lg:grid-cols-[220px_1fr]">
      <div className="grid place-items-center bg-gradient-to-br from-blue-50 to-violet-50 p-6 text-center">
        <div className="grid size-36 place-items-center rounded-full" style={{ background: `conic-gradient(rgb(37 99 235) ${(accuracy ?? 0) * 3.6}deg, rgb(226 232 240) 0deg)` }} role="img" aria-label={accuracy === null ? "Chưa có độ chính xác" : `Độ chính xác ${accuracy}%`}><div className="grid size-28 place-items-center rounded-full bg-white shadow-sm"><div><p className="text-3xl font-black text-slate-950">{accuracy === null ? "—" : `${accuracy}%`}</p><p className="text-xs font-bold text-slate-500">Trả lời đúng</p></div></div></div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Tính từ các câu đã trả lời trong tài liệu này</p>
      </div>
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <CompactMetric value={`${evaluatedCount}/${items.length}`} label="Đã có kết quả" />
          <CompactMetric value={`${classifiedCount}/${items.length}`} label="Đã đủ dữ liệu" />
          <CompactMetric value={activity.flashcardSessionCount ?? 0} label="Lượt ôn thẻ" />
          <CompactMetric value={activity.quizCompletionCount ?? 0} label="Lượt làm bài" />
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Phân bố kiến thức</p><h2 className="mt-1 text-lg font-black text-slate-950">Các mức nắm vững</h2></div><p className="text-xs font-bold text-slate-500">{completed} lượt học đã hoàn thành</p></div>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={distribution.map((item) => `${item.label}: ${item.count}`).join(", ")}>
            {items.length ? distribution.map((item) => item.count ? <span key={item.value} className={chartColors[item.value]} style={{ width: `${(item.count / items.length) * 100}%` }} /> : null) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {distribution.map((item) => <div key={item.value} className="flex items-center gap-2 text-xs text-slate-600"><span className={`size-3 shrink-0 rounded-full ${chartColors[item.value]}`} /><span><strong className="text-slate-900">{item.count}</strong> {item.label.toLowerCase()}</span></div>)}
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-start gap-3 border-t border-blue-100 bg-blue-50 px-5 py-4 sm:px-6"><CircleHelp className="mt-0.5 size-5 shrink-0 text-brand-700" /><p className="text-sm leading-6 text-slate-600"><strong className="text-slate-900">Cách đọc gợi ý luyện tiếp:</strong> đây không phải điểm số. Hệ thống chọn mức câu hỏi cho lần luyện sau: kiến thức nền khi bạn cần ôn lại, vừa sức khi đang tiến bộ và nâng cao khi đã nắm vững. Mỗi khái niệm cần ít nhất {minimumEvidence} lượt đánh giá để có kết luận đáng tin cậy hơn.</p></div>
  </section>;
}

function CompactMetric({ value, label }: { value: number | string; label: string }) {
  return <div><p className="text-2xl font-black text-brand-700">{value}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p></div>;
}

function ConceptProgressRow({ item, minimumEvidence }: { item: ConceptMasteryView; minimumEvidence: number }) {
  const hasEvidence = item.evidenceCount > 0;
  const classified = item.state !== "NEW";
  const masteryPercent = classified ? Math.round(item.masteryScore * 100) : null;
  const evidenceProgress = Math.min(100, Math.round((item.evidenceCount / minimumEvidence) * 100));
  const totalAnswers = item.correctEvidence + item.incorrectEvidence;
  const hasQuizAnswers = totalAnswers > 0;
  const accuracy = hasQuizAnswers
    ? Math.round((item.correctEvidence / totalAnswers) * 100)
    : null;
  const guidance = nextPracticeGuidance(item);
  const statusLabel = !hasEvidence
    ? "Chưa bắt đầu"
    : classified
      ? masteryLabels[item.state]
      : "Đang đánh giá";

  return (
    <article data-testid="mastery-concept" className="grid gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.5fr)_minmax(160px,0.9fr)_minmax(190px,1fr)_minmax(190px,1fr)] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <h3 className="font-black text-slate-950">{item.conceptName}</h3>
        <span className={`mt-2 inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${masteryTones[item.state]}`}>
          {statusLabel}
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 lg:hidden">Kết quả bài luyện</p>
        <div className="mt-1 flex items-baseline justify-between gap-3"><p className="text-sm font-black text-slate-900">{hasQuizAnswers ? `${formatEvidence(item.correctEvidence)} đúng · ${formatEvidence(item.incorrectEvidence)} sai` : "Chưa làm bài"}</p><span className="text-xs font-bold text-slate-500">{accuracy === null ? "—" : `${accuracy}%`}</span></div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${formatEvidence(totalAnswers)} câu đã trả lời`}>{totalAnswers ? <><span className="bg-emerald-500" style={{ width: `${accuracy}%` }} /><span className="bg-rose-400" style={{ width: `${100 - (accuracy ?? 0)}%` }} /></> : null}</div>
      </div>
      <div
        className="min-w-0"
      >
        <div className="flex items-baseline justify-between gap-3"><p className="text-xs font-bold text-slate-400 lg:hidden">{classified ? "Mức nắm vững" : "Mức độ dữ liệu"}</p><span className="text-sm font-black text-slate-900">{classified ? `${masteryPercent}%` : `${formatEvidence(item.evidenceCount)}/${minimumEvidence} lượt`}</span></div>
        <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={classified ? `Mức nắm vững ${item.conceptName}` : `Dữ liệu đánh giá ${item.conceptName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={classified ? masteryPercent ?? 0 : evidenceProgress}
      >
        <div
          className={`h-full rounded-full ${classified ? "bg-brand-600" : "bg-amber-400"}`}
          style={{ width: `${classified ? masteryPercent : evidenceProgress}%` }}
        />
        </div>
        {!classified ? <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {hasEvidence
            ? `Cần thêm ${formatEvidence(Math.max(0, minimumEvidence - item.evidenceCount))} lượt để xác định mức độ`
            : "Làm bài luyện để bắt đầu đánh giá"}
        </p> : null}
      </div>
      <div className={`rounded-xl border px-3 py-2.5 ${guidance.tone}`}>
        <p className="text-xs font-black uppercase tracking-wide">{guidance.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{guidance.detail}</p>
      </div>
    </article>
  );
}

const practiceGuidance = {
  EASY: { title: "Ôn lại kiến thức nền", detail: "Làm câu hỏi cơ bản để củng cố phần chưa chắc.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  MEDIUM: { title: "Luyện tập vừa sức", detail: "Tiếp tục với câu hỏi mức trung bình để làm chắc kiến thức.", tone: "border-blue-200 bg-blue-50 text-brand-800" },
  HARD: { title: "Thử bài nâng cao", detail: "Làm câu hỏi khó hơn để hiểu sâu và vận dụng tốt hơn.", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
} as const;

function nextPracticeGuidance(item: ConceptMasteryView) {
  if (item.state === "NEW") {
    return item.evidenceCount > 0
      ? {
          title: "Luyện thêm câu cơ bản",
          detail: "Cần thêm kết quả để xác định mức độ nắm vững của bạn.",
          tone: "border-amber-200 bg-amber-50 text-amber-800",
        }
      : {
          title: "Bắt đầu từ kiến thức nền",
          detail: "Làm câu hỏi cơ bản để có kết quả đánh giá đầu tiên.",
          tone: "border-slate-200 bg-slate-50 text-slate-700",
        };
  }
  return practiceGuidance[item.targetDifficulty];
}

function EmptyFilter({
  filter,
  hasConcepts,
  onPractice,
}: {
  filter: ConceptMasteryState | "ALL";
  hasConcepts: boolean;
  onPractice: () => void;
}) {
  const label = filters.find((item) => item.value === filter)?.label ?? "mức này";
  return (
    <section className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div>
        <Target className="mx-auto size-8 text-slate-300" />
        <h2 className="mt-4 text-lg font-black text-slate-950">
          {hasConcepts ? `Chưa có khái niệm ở mức “${label}”` : "Chưa có khái niệm để đánh giá"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          {hasConcepts
            ? "Tiếp tục làm bài luyện để bổ sung kết quả cho từng khái niệm. Khi đủ dữ liệu, Study Coach sẽ tự cập nhật nhóm phù hợp."
            : "Hãy chọn một tài liệu đã xử lý thành công rồi bắt đầu học."}
        </p>
        {hasConcepts ? <Button className="mt-5" onClick={onPractice}>Tiếp tục làm bài luyện</Button> : null}
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <div className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white" aria-live="polite">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-7 animate-spin text-brand-600" />
        <p className="mt-3 text-sm font-bold text-slate-500">Đang tổng hợp tiến độ...</p>
      </div>
    </div>
  );
}

function formatEvidence(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
