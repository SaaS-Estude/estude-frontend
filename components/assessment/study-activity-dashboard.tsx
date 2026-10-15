"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, Clock3, FileText, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { examAttemptService } from "@/lib/assessment-api";
import { studyActivityReviewSections } from "@/lib/study-activity-review";
import type { StudyActivityDashboard as Dashboard, StudyPracticeSet } from "@/types/assessment";

const durationLabel = (seconds: number) => {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};

const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

export function StudyActivityDashboard({
  attemptId,
  practice,
}: {
  attemptId: string;
  practice: StudyPracticeSet | null;
}) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [view, setView] = useState<{ id: string; name: string; url: string } | null>(null);
  const viewUpdates = useRef<Promise<unknown>>(Promise.resolve());

  const updateView = useCallback((viewId: string, close = false, visible = true) => {
    const task = viewUpdates.current
      .catch(() => {})
      .then(() => examAttemptService.updateStudyMaterialView(attemptId, viewId, close, visible));
    viewUpdates.current = task;
    return task;
  }, [attemptId]);

  const reload = useCallback(async () => {
    try {
      setDashboard(await examAttemptService.getStudyActivity(attemptId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải thống kê ôn tập");
    }
  }, [attemptId]);

  useEffect(() => {
    void reload();
  }, [reload, practice?.attemptId, practice?.submittedAt]);

  useEffect(() => {
    if (!view) return;
    const viewId = view.id;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void updateView(viewId).catch(() => {});
    }, 15000);
    const onVisibilityChange = () => {
      void updateView(viewId, false, document.visibilityState === "visible").catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void updateView(viewId, true).catch(() => {});
    };
  }, [updateView, view]);

  async function openMaterial(material: Dashboard["materials"][number]) {
    setOpeningId(material.id);
    setError("");
    try {
      const opened = await examAttemptService.openStudyMaterial(attemptId, material.id);
      setView({
        id: opened.id,
        name: material.name,
        url: material.pages.length ? `${opened.url}#page=${material.pages[0]}` : opened.url,
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở tài liệu");
    } finally {
      setOpeningId(null);
    }
  }

  async function closeMaterial() {
    if (!view) return;
    const viewId = view.id;
    try {
      await updateView(viewId, true);
    } catch {
      // The cleanup retries closing when the preview is removed.
    }
    setView(null);
    await reload();
  }

  const practiceHistory = (dashboard?.practice ?? []).filter(
    (item) => item.status === "SUBMITTED",
  );
  const materialViews = dashboard?.materialViews ?? [];
  const latest = practiceHistory.at(-1);
  const latestAccuracy = latest?.totalQuestions
    ? Math.round((latest.correctCount / latest.totalQuestions) * 100)
    : null;
  const bestAccuracy = practiceHistory.length
    ? Math.max(...practiceHistory.map((item) => item.totalQuestions
      ? Math.round((item.correctCount / item.totalQuestions) * 100)
      : 0))
    : null;
  const viewSeconds = materialViews.reduce((sum, item) => sum + item.activeSeconds, 0);
  const openedMaterialCount = new Set(materialViews.map((item) => item.materialId)).size;

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <BarChart3 className="size-5 text-brand-600" /> Tiến độ ôn tập
          </h2>
          <p className="mt-1 text-sm text-slate-500">Thống kê từ các lượt luyện và phiên xem tài liệu của bài này.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          <RotateCcw className="size-4" /> Cập nhật
        </Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Lượt luyện đã nộp", value: String(practiceHistory.length), note: "Ghi nhận theo từng lần làm" },
          { label: "Kết quả gần nhất", value: latestAccuracy === null ? "—" : `${latestAccuracy}%`, note: latest ? `${latest.correctCount}/${latest.totalQuestions} câu đúng` : "Chưa có lượt luyện" },
          { label: "Kết quả tốt nhất", value: bestAccuracy === null ? "—" : `${bestAccuracy}%`, note: "Trong các lượt đã nộp" },
          { label: "Thời gian xem tài liệu", value: viewSeconds ? durationLabel(viewSeconds) : "0 phút", note: `${openedMaterialCount} tài liệu đã mở` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-black">Kết quả theo lượt luyện</h3>
          {practiceHistory.length ? (
            <div className="mt-4 space-y-3">
              {practiceHistory.map((item) => {
                const accuracy = item.totalQuestions ? Math.round((item.correctCount / item.totalQuestions) * 100) : 0;
                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>Lượt {item.attemptNumber} · {dateLabel(item.submittedAt)}</span>
                      <span>{item.correctCount}/{item.totalQuestions} · {accuracy}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${accuracy >= 80 ? "bg-emerald-500" : accuracy >= 50 ? "bg-brand-500" : "bg-amber-500"}`} style={{ width: `${accuracy}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Chưa có lượt luyện đã nộp. Biểu đồ sẽ xuất hiện sau khi bạn làm bài luyện.</p>}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-black">Lịch sử ôn tập</h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {[
              ...practiceHistory.map((item) => ({
                id: `practice-${item.id}`,
                at: item.submittedAt ?? "",
                icon: "practice",
                title: `Nộp bài luyện · lượt ${item.attemptNumber}`,
                detail: `${item.correctCount}/${item.totalQuestions} câu đúng · ${durationLabel(item.durationSeconds)}`,
              })),
              ...materialViews.map((item) => ({
                id: `material-${item.id}`,
                at: item.openedAt,
                icon: "material",
                title: `Xem ${item.materialName}`,
                detail: `Thời gian ghi nhận ${durationLabel(item.activeSeconds)}`,
              })),
            ].sort((a, b) => b.at.localeCompare(a.at)).map((item) => (
              <div key={item.id} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <span className="mt-0.5 text-brand-600">{item.icon === "practice" ? <BarChart3 className="size-4" /> : <BookOpen className="size-4" />}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{dateLabel(item.at)} · {item.detail}</p>
                </div>
              </div>
            ))}
            {!practiceHistory.length && !materialViews.length ? <p className="text-sm text-slate-500">Chưa có hoạt động ôn tập được ghi nhận.</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/30 p-4">
        <h3 className="flex items-center gap-2 font-black text-slate-900">
          <Sparkles className="size-4 text-violet-600" /> Đánh giá sau quá trình tự ôn
        </h3>
        {dashboard?.activityReview?.source === "AI" && dashboard.activityReview.comment ? (
          <>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {studyActivityReviewSections(dashboard.activityReview.comment).map((item) => (
                <div key={item.label} className="rounded-lg bg-white p-3">
                  <p className={`text-xs font-black uppercase tracking-wide ${item.tone}`}>
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{item.content}</p>
                </div>
              ))}
            </div>
            {dashboard.activityReview.generatedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Cập nhật lúc {dateLabel(dashboard.activityReview.generatedAt)} khi có hoạt động ôn tập mới.
              </p>
            ) : null}
          </>
        ) : dashboard?.activityReview?.source === "ERROR" ? (
          <p className="mt-2 text-sm text-amber-700">
            Chưa thể tạo đánh giá lúc này. Hệ thống sẽ tự thử lại khi có hoạt động mới.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Hoàn thành một lượt luyện hoặc mở tài liệu để nhận đánh giá.
          </p>
        )}
      </div>

      {dashboard?.materials.length ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h3 className="flex items-center gap-2 font-black"><FileText className="size-4 text-brand-600" /> Tài liệu môn học</h3>
          <p className="mt-1 text-xs text-slate-500">Thời gian xem chỉ tính khi bản xem trước đang mở trong tab hiển thị; đây không phải xác nhận đã đọc hết tài liệu.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {dashboard.materials.map((material) => (
              <div key={material.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{material.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{material.pages.length ? `Trang gợi ý: ${material.pages.join(", ")}` : "Tài liệu của môn"}</p>
                </div>
                <Button size="sm" variant="outline" disabled={openingId === material.id} onClick={() => void openMaterial(material)}>
                  <BookOpen className="size-4" /> {openingId === material.id ? "Đang mở" : "Đọc"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Modal open={view !== null} title={view?.name ?? "Đọc tài liệu"} width="max-w-[1400px]" bodyClassName="max-h-[calc(100dvh-5rem)] overflow-y-auto !p-2" compact onClose={() => void closeMaterial()}>
        {view ? (
          <div>
            <p className="flex items-center gap-1.5 px-2 pb-2 text-xs text-slate-500"><Clock3 className="size-3.5" /> Thời gian xem được ghi nhận khi tab này đang hiển thị.</p>
            <iframe src={view.url} title={`Đọc ${view.name}`} className="h-[calc(100dvh-9rem)] min-h-[520px] w-full rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
