"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, BookOpenCheck, BrainCircuit, CalendarDays,
  Check, CheckCircle2, Circle, Clock3, Flag, MessageCircleMore, Target,
} from "lucide-react";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { learningPlanService } from "@/lib/assessment-api";
import {
  LEARNING_SUPPORT_CHANGED_EVENT,
  learningSupportService,
} from "@/lib/learning-support-api";
import { StudentImprovementPanel } from "@/components/assessment/student-improvement-panel";
import type {
  LearningPlan,
  LearningSupportRequest,
  LearningTask,
} from "@/types/assessment";

const planStatus: Record<LearningPlan["status"], { label: string; tone: string }> = {
  DRAFT: { label: "Bản nháp", tone: "bg-slate-100 text-slate-700" },
  ASSIGNED: { label: "Đã giao", tone: "bg-blue-50 text-brand-700" },
  IN_PROGRESS: { label: "Đang học", tone: "bg-amber-50 text-amber-700" },
  WAITING_REASSESSMENT: { label: "Chờ đánh giá lại", tone: "bg-violet-50 text-violet-700" },
  ACHIEVED: { label: "Đạt mục tiêu", tone: "bg-emerald-50 text-emerald-700" },
  NEEDS_ADJUSTMENT: { label: "Cần điều chỉnh", tone: "bg-rose-50 text-rose-700" },
  CANCELLED: { label: "Đã hủy", tone: "bg-slate-100 text-slate-500" },
  COMPLETED: { label: "Đã hoàn thành", tone: "bg-emerald-50 text-emerald-700" },
};

type TaskState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DRAFT" | "ASSIGNED";
const taskStatus: Record<TaskState, { label: string; tone: string }> = {
  NOT_STARTED: { label: "Chưa bắt đầu", tone: "border-slate-200 bg-slate-50 text-slate-600" },
  IN_PROGRESS: { label: "Đang thực hiện", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Hoàn thành", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Đã hủy", tone: "border-slate-200 bg-slate-100 text-slate-500" },
  DRAFT: { label: "Chưa giao", tone: "border-slate-200 bg-slate-50 text-slate-500" },
  ASSIGNED: { label: "Chưa bắt đầu", tone: "border-slate-200 bg-slate-50 text-slate-600" },
};

const stateOf = (task: LearningTask): TaskState =>
  (task.progress?.status ?? task.status) as TaskState;

function displayedPlanStatus(plan: LearningPlan) {
  return plan.status === "COMPLETED" && !plan.tasks.some((task) => task.kind === "PRACTICE")
    ? "Đã đọc tài liệu"
    : planStatus[plan.status].label;
}

export function StudentLearningPlansPage({ detail = false }: { detail?: boolean }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [supportThreads, setSupportThreads] = useState<
    Record<string, LearningSupportRequest>
  >({});
  const [sentTaskId, setSentTaskId] = useState<string | null>(null);

  async function reload() {
    if (detail && params.id) setPlans([await learningPlanService.getMine(params.id)]);
    else setPlans(await learningPlanService.listMine());
  }

  useEffect(() => {
    let live = true;
    (detail && params.id
      ? learningPlanService.getMine(params.id).then((item) => [item])
      : learningPlanService.listMine())
      .then((items) => { if (live) setPlans(items); })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Không thể tải lộ trình"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [detail, params.id]);

  useEffect(() => {
    if (!detail || !params.id) return;
    let live = true;
    void learningSupportService
      .listStudent(params.id)
      .then((items) => {
        if (!live) return;
        setSupportThreads(
          Object.fromEntries(items.map((item) => [item.taskId, item])),
        );
        const unread = items.filter((item) => item.unreadForStudent);
        return Promise.all(
          unread.map((item) =>
            learningSupportService.markStudentRead(params.id!, item.id),
          ),
        ).then((readItems) => {
          if (!live || !readItems.length) return;
          setSupportThreads((current) => ({
            ...current,
            ...Object.fromEntries(
              readItems.map((item) => [item.taskId, item]),
            ),
          }));
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [detail, params.id]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try { await action(); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật nhiệm vụ"); }
    finally { setBusy(false); }
  }

  async function sendSupportRequest(
    planId: string,
    taskId: string,
  ) {
    const content = (note[taskId] ?? "").trim();
    if (!content) return;
    setBusy(true);
    setError("");
    setSentTaskId(null);
    try {
      const request = await learningPlanService.reportDifficulty(
        planId,
        taskId,
        content,
      );
      setSupportThreads((current) => ({ ...current, [taskId]: request }));
      setNote((current) => ({ ...current, [taskId]: "" }));
      setSentTaskId(taskId);
      window.dispatchEvent(new Event(LEARNING_SUPPORT_CHANGED_EVENT));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể gửi yêu cầu hỗ trợ",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <Link href="/student/learning-plans" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="size-4" /> Lộ trình đã giao
          </Link>
          <h1 className="mt-3 text-2xl font-black text-slate-950">{detail ? "Chi tiết lộ trình" : "Lộ trình học của tôi"}</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi phần cần ôn, kết quả bài luyện và tiêu chí hoàn thành của từng lộ trình.</p>
        </header>

        {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải lộ trình...</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
        {!loading && !plans.length ? <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Chưa có lộ trình được giao.</p> : null}

        {plans.map((plan) => {
          const next = plan.tasks.find((task) => task.status === "ASSIGNED" && task.progress?.status !== "COMPLETED");
          const completedCount = plan.tasks.filter((task) => task.progress?.status === "COMPLETED").length;
          const progress = plan.tasks.length ? Math.round((completedCount / plan.tasks.length) * 100) : 0;
          const materialIncomplete = plan.tasks.some((task) => task.kind === "MATERIAL" && task.progress?.status !== "COMPLETED");

          return (
            <article key={plan.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-600">Lộ trình hỗ trợ</p>
                    <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">{plan.title}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${planStatus[plan.status].tone}`}>{displayedPlanStatus(plan)}</span>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-600">{plan.summary}</p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-blue-100 bg-white/90 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-brand-700"><Target className="size-4" /> Mục tiêu ôn tập</p>
                    <p className="mt-2 font-bold text-slate-900">{plan.objective?.title ?? plan.objectiveId}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><Flag className="size-4" /> {plan.objective?.granularity === "MATERIAL" ? "Tiêu chí hoàn thành" : "Tiêu chí đánh giá lại"}</p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">{plan.successCriteria}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="min-w-52 flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Tiến độ {completedCount}/{plan.tasks.length} bước</span><span>{progress}%</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} /></div>
                  </div>
                  {plan.dueAt ? <p className="inline-flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="size-4 text-slate-400" /> Hạn {new Date(plan.dueAt).toLocaleString("vi-VN")}</p> : null}
                </div>

                {next ? (
                  <div className={`mt-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm ${next.overdue ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                    {next.overdue ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Clock3 className="mt-0.5 size-4 shrink-0" />}
                    <p><b>Bước tiếp theo:</b> {next.title}{next.overdue ? " · Đã quá hạn" : ""}</p>
                  </div>
                ) : null}
                {!detail ? <Link href={`/student/learning-plans/${plan.id}`} className="mt-5 inline-block font-bold text-brand-700 hover:underline">Mở lộ trình →</Link> : null}
              </div>

              {detail ? (
                <section className="p-5 sm:p-7">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-600">Các bước thực hiện</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">Học theo đúng thứ tự bên dưới</h3>
                  <ol className="mt-5 space-y-4">
                    {plan.tasks.map((task) => {
                      const state = stateOf(task);
                      const status = task.overdue ? { label: "Quá hạn", tone: "border-rose-200 bg-rose-50 text-rose-700" } : taskStatus[state];
                      const completed = task.progress?.status === "COMPLETED";
                      const practiceLocked = plan.objective?.granularity === "MATERIAL" && task.kind === "PRACTICE" && materialIncomplete;
                      const canAct = task.status === "ASSIGNED" && ["ASSIGNED", "IN_PROGRESS"].includes(plan.status);
                      const Icon = task.kind === "MATERIAL" ? BookOpenCheck : BrainCircuit;
                      const supportThread = supportThreads[task.id];

                      return (
                        <li key={task.id} className={`rounded-2xl border p-4 sm:p-5 ${completed ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-start gap-3 sm:gap-4">
                            <span className={`grid size-10 shrink-0 place-items-center rounded-full font-black ${completed ? "bg-emerald-600 text-white" : "bg-blue-50 text-brand-700"}`}>{completed ? <Check className="size-5" /> : task.order}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon className="size-4" /> {task.kind === "MATERIAL" ? "Tài liệu" : "Bài luyện"}</p><h4 className="mt-1 font-black text-slate-950">{task.title}</h4></div>
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status.tone}`}>{status.label}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                              {task.kind === "PRACTICE" ? <p className="mt-2 text-xs text-slate-500">Bước này tự hoàn thành sau khi bạn nộp bài luyện.</p> : null}
                              {practiceLocked ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-700"><Circle className="size-3.5 fill-current" /> Hoàn thành bước đọc tài liệu trước khi làm bài luyện.</p> : null}
                              {!supportThread && task.progress?.difficultyNote ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><b>Khó khăn đã báo:</b> {task.progress.difficultyNote}</p> : null}

                              {canAct ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button size="sm" disabled={busy || !task.actionUrl || practiceLocked} onClick={() => void run(async () => { const result = await learningPlanService.startTask(plan.id, task.id); if (result.actionUrl?.startsWith("/student/")) router.push(result.actionUrl); })}>
                                    <Icon className="size-4" /> {task.kind === "MATERIAL" ? "Mở tài liệu" : "Làm bài luyện"}
                                  </Button>
                                  {task.kind === "MATERIAL" && task.progress?.status !== "COMPLETED" ? <Button size="sm" variant="outline" disabled={busy || task.progress?.status === "NOT_STARTED"} onClick={() => void run(() => learningPlanService.completeMaterial(plan.id, task.id))}><CheckCircle2 className="size-4" /> Xác nhận đã đọc xong</Button> : null}
                                </div>
                              ) : null}

                              {task.status === "ASSIGNED" ? (
                                <div className="mt-4 border-t border-slate-100 pt-4">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><MessageCircleMore className="size-4" /> Cần giáo viên hỗ trợ?</label>
                                    {supportThread ? (
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                        supportThread.status === "RESOLVED"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : supportThread.status === "IN_PROGRESS"
                                            ? "bg-blue-50 text-brand-700"
                                            : supportThread.teacherReadAt
                                              ? "bg-violet-50 text-violet-700"
                                              : "bg-amber-50 text-amber-700"
                                      }`}>
                                        {supportThread.status === "RESOLVED"
                                          ? "Đã xử lý"
                                          : supportThread.status === "IN_PROGRESS"
                                            ? "Giáo viên đang xử lý"
                                            : supportThread.teacherReadAt
                                              ? "Giáo viên đã xem"
                                              : "Đã gửi · chờ giáo viên xem"}
                                      </span>
                                    ) : null}
                                  </div>
                                  {supportThread?.messages.length ? (
                                    <div className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3">
                                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Lịch sử trao đổi</p>
                                      {supportThread.messages.map((message) => {
                                        const mine = message.authorRole === "STUDENT";
                                        return (
                                          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-brand-600 text-white" : "border border-blue-100 bg-white text-slate-700"}`}>
                                              <p className={`text-[10px] font-bold ${mine ? "text-blue-100" : "text-brand-600"}`}>{mine ? "Bạn" : "Giáo viên"}</p>
                                              <p className="mt-0.5 whitespace-pre-wrap">{message.content}</p>
                                              <time className={`mt-1 block text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleString("vi-VN")}</time>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  {sentTaskId === task.id ? <p role="status" className="mb-2 text-xs font-semibold text-emerald-700">Đã gửi yêu cầu đến giáo viên, trang vẫn giữ nguyên vị trí hiện tại.</p> : null}
                                  <div className="flex gap-2">
                                    <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-blue-100" value={note[task.id] ?? ""} onChange={(event) => { setSentTaskId(null); setNote((current) => ({ ...current, [task.id]: event.target.value })); }} placeholder={supportThread ? "Gửi thêm nội dung cho giáo viên" : "Mô tả nội dung bạn đang gặp khó khăn"} />
                                    <Button size="sm" variant="outline" disabled={busy || !(note[task.id] ?? "").trim()} onClick={() => void sendSupportRequest(plan.id, task.id)}>Gửi</Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ) : null}

              {plan.status === "WAITING_REASSESSMENT" ? <p className="mx-5 mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 sm:mx-7 sm:mb-7">Đã hoàn tất các bước học. Hãy chờ bài đánh giá lại và nhận xét của giáo viên.</p> : null}
              {plan.status === "COMPLETED" ? <p className="mx-5 mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 sm:mx-7 sm:mb-7">{plan.tasks.some((task) => task.kind === "PRACTICE") ? "Bạn đã hoàn thành các mục ôn tập và đạt ngưỡng bài luyện." : "Bạn đã xác nhận đọc xong tài liệu. Giáo viên có thể bổ sung bài luyện để kiểm tra kiến thức."}</p> : null}

              {detail && plan.materialStudy && (plan.materialStudy.sections.length > 0 || plan.tasks.some((task) => task.kind === "PRACTICE")) ? (
                <section className="mx-5 mb-5 rounded-2xl border border-blue-100 bg-blue-50/30 p-4 text-sm sm:mx-7 sm:mb-7">
                  <h3 className="font-bold text-slate-900">Phần kiến thức cần ôn</h3>
                  <p className="mt-1 text-slate-600">Đối chiếu {plan.materialStudy.matchedCount}/{plan.materialStudy.missedCount} câu sai với tài liệu. Bài luyện gần nhất: {plan.materialStudy.latestScore ?? "—"}% · Ngưỡng {plan.targetAccuracyPercent ?? "—"}%.</p>
                  {plan.materialStudy.sections.map((section) => <div key={section.id ?? section.title} className="mt-3 rounded-xl bg-white p-3"><p className="font-bold text-brand-700">{section.title} · trang {section.page}</p><p className="mt-1 text-slate-700">{section.theory}</p><p className="mt-1 text-xs text-slate-500">{section.citations[0]?.documentName}, trang {section.citations[0]?.page}: {section.citations[0]?.excerpt}</p></div>)}
                  {plan.tasks.some((task) => task.kind === "PRACTICE") ? <Link href={`/student/learning-plans/${plan.id}/practice`} className="mt-3 inline-block font-bold text-brand-700 underline">Ôn lý thuyết và làm bài luyện</Link> : null}
                </section>
              ) : null}
              {detail && plan.objective?.granularity !== "MATERIAL" ? <div className="px-5 pb-5 sm:px-7 sm:pb-7"><StudentImprovementPanel planId={plan.id} /></div> : null}
            </article>
          );
        })}
      </div>
    </StudentShell>
  );
}
