"use client";

import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { ExamDetailTabs } from "@/components/assessment/exam-detail-tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-control";
import { useActionNotification } from "@/components/ui/action-notification";
import { usePermissions } from "@/context/permissions-context";
import { examService } from "@/lib/assessment-api";
import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  Exam,
  ExamClassAiAnalysis,
  ExamClassAnalysisState,
  ExamClassReport,
  ExamInsightActionInput,
} from "@/types/assessment";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function ExamAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  return <ExamAnalysisContent key={id} examId={id} />;
}

function ExamAnalysisContent({ examId }: { examId: string }) {
  const { can, loading: permissionsLoading } = usePermissions();
  const allowed = can("exams.submissions");
  const canSendNotifications = can("notifications.send");
  const [exam, setExam] = useState<Exam | null>(null);
  const [report, setReport] = useState<ExamClassReport | null>(null);
  const [state, setState] = useState<ExamClassAnalysisState | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [command, setCommand] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const consumedCommand = useRef(0);

  useEffect(() => {
    if (permissionsLoading || !allowed) return;
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isRefresh = command > consumedCommand.current;
    consumedCommand.current = command;

    async function poll(refresh = false, fresh = false) {
      if (!active || inFlight) return;
      inFlight = true;
      if (timer) clearTimeout(timer);
      try {
        if (refresh) setRequesting(true);
        const next = refresh
          ? await examService.analyzeClassReport(examId, true)
          : await examService.getClassAnalysis(examId, fresh);
        if (!active) return;
        setState(next);
        setConnectionError("");
        if (["QUEUED", "PROCESSING"].includes(next.status)) {
          timer = setTimeout(() => void poll(), 3_000);
        }
      } catch (cause) {
        if (active) {
          setConnectionError(
            cause instanceof Error
              ? cause.message
              : "Chưa thể kết nối để lấy báo cáo. Hệ thống sẽ tự thử lại.",
          );
          timer = setTimeout(() => void poll(), 5_000);
        }
      } finally {
        inFlight = false;
        if (active) setRequesting(false);
      }
    }

    void examService
      .getExamById(examId)
      .then((data) => {
        if (active) setExam(data);
      })
      .catch(() => {});
    void examService
      .getClassReport(examId)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch(() => {});
    void poll(isRefresh, !isRefresh);
    const onFocus = () => void poll(false, true);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [examId, allowed, permissionsLoading, command]);

  const working =
    requesting || state?.status === "QUEUED" || state?.status === "PROCESSING";
  const analysis = state?.analysis;
  const snapshot = state?.snapshot;

  return (
    <AssessmentShell>
      <ExamDetailTabs examId={examId} active="analysis" />
      <div className="space-y-3 text-[13px]">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div>
            <p className="mb-1 flex items-center gap-2 font-semibold text-brand-700">
              <Sparkles className="size-4" />
              Phân tích AI
            </p>
            <h1 className="text-lg font-bold text-slate-900">
              {exam?.title ?? snapshot?.title ?? "Kết quả bài kiểm tra"}
            </h1>
            <p className="mt-1 text-slate-500">
              {exam
                ? `${toVietnameseSubjectName(exam.subjectName)} · ${exam.className}`
                : snapshot
                  ? `${toVietnameseSubjectName(snapshot.subjectName)} · ${snapshot.className}`
                  : "Báo cáo kết quả lớp"}
            </p>
            {analysis ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="size-3.5" />
                  Đã lưu báo cáo
                </span>
                <span>{formatDate(analysis.generatedAt)}</span>
                {snapshot ? (
                  <span>
                    {snapshot.submittedStudentCount}/
                    {snapshot.enrolledStudentCount} học sinh đã nộp tại thời
                    điểm phân tích
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {allowed && state ? (
            <Button
              permission="exams.submissions"
              variant="secondary"
              className="!text-[13px]"
              disabled={working || !state.canAnalyze}
              onClick={() => {
                setRequesting(true);
                setCommand((value) => value + 1);
              }}
            >
              <RefreshCw
                className={`size-4 ${working ? "animate-spin" : ""}`}
              />
              {working
                ? "Đang phân tích..."
                : state.status === "FAILED"
                  ? "Thử lại phân tích"
                  : analysis
                    ? state.hasNewData
                      ? "Cập nhật phân tích"
                      : "Phân tích lại"
                    : "Phân tích AI"}
            </Button>
          ) : null}
        </header>

        {!permissionsLoading && !allowed ? (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">
            Bạn chưa có quyền xem phân tích bài kiểm tra.
          </p>
        ) : (
          <>
            {connectionError ? (
              <p
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"
              >
                {connectionError} Đang tự kết nối lại; báo cáo đã lưu vẫn được
                giữ.
              </p>
            ) : null}
            {state?.hasNewData && analysis ? (
              <p className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-brand-800">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Có dữ liệu mới chưa được phân tích. Hiện có{" "}
                  {state.currentSubmittedStudentCount} học sinh đã nộp. Bấm “Cập
                  nhật phân tích” để làm mới báo cáo.
                </span>
              </p>
            ) : null}
            {state?.status === "FAILED" ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700"
              >
                {state.error || "Phân tích chưa hoàn tất. Vui lòng thử lại."}
                {analysis ? " Báo cáo trước đó vẫn được giữ bên dưới." : ""}
              </p>
            ) : null}
            {working || (!state && !connectionError) ? (
              <section
                role="status"
                aria-live="polite"
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <LoaderCircle className="size-5 animate-spin text-brand-600" />
                  <div>
                    <h2 className="font-bold text-slate-900">
                      {!state && !requesting
                        ? "Đang tải báo cáo đã lưu..."
                        : state?.status === "QUEUED"
                          ? "Đã tiếp nhận yêu cầu phân tích"
                          : "Đang phân tích kết quả lớp..."}
                    </h2>
                    <p className="mt-1 text-slate-500">
                      Bạn có thể chuyển tab hoặc quay lại sau. Kết quả sẽ được
                      lưu tự động.
                    </p>
                  </div>
                </div>
                {!analysis ? (
                  <div
                    aria-hidden="true"
                    className="mt-5 space-y-3 motion-safe:animate-pulse"
                  >
                    <div className="h-4 w-2/3 rounded bg-slate-100" />
                    <div className="h-4 w-full rounded bg-slate-100" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-28 rounded-lg bg-slate-50" />
                      <div className="h-28 rounded-lg bg-slate-50" />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
            {state && !state.canAnalyze && !analysis && !working ? (
              <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
                Chưa có bài nộp để phân tích. Báo cáo sẽ sẵn sàng sau khi học
                sinh nộp bài.
              </p>
            ) : null}
            {analysis ? (
              <SavedAnalysisReport
                analysis={analysis}
                snapshot={snapshot ?? null}
              />
            ) : null}
            {analysis &&
            report &&
            exam &&
            analysis.analysisScope !== "ASSESSMENT_ONLY" ? (
              <InsightActionPanel
                exam={exam}
                report={report}
                analysis={analysis}
                canSend={canSendNotifications}
              />
            ) : null}
          </>
        )}
      </div>
    </AssessmentShell>
  );
}

function InsightActionPanel({
  exam,
  report,
  analysis,
  canSend,
}: {
  exam: Exam;
  report: ExamClassReport;
  analysis: ExamClassAiAnalysis;
  canSend: boolean;
}) {
  const { notify } = useActionNotification();
  const groups = useMemo(() => {
    const result: Array<{
      id: string;
      label: string;
      reason: string;
      studentIds: string[];
    }> = [];
    const supportIds = report.students
      .filter((student) => student.needsSupport)
      .map((student) => student.id);
    if (supportIds.length)
      result.push({
        id: "support",
        label: `Nhóm cần hỗ trợ (${supportIds.length})`,
        reason: "Kết quả hoặc chủ đề đang dưới ngưỡng hỗ trợ.",
        studentIds: supportIds,
      });
    for (const topic of report.topicPerformance) {
      if (!topic.supportStudentIds.length) continue;
      result.push({
        id: `topic:${topic.topicId || topic.topicName}`,
        label: `${topic.topicName} (${topic.supportStudentIds.length})`,
        reason: `Độ chính xác chủ đề ${topic.accuracy ?? 0}%, dưới ngưỡng ${report.policy.supportThresholdPercent}%.`,
        studentIds: topic.supportStudentIds,
      });
    }
    const pendingIds = report.students
      .filter((student) => student.participationStatus !== "SUBMITTED")
      .map((student) => student.id);
    if (pendingIds.length)
      result.push({
        id: "pending",
        label: `Chưa nộp bài (${pendingIds.length})`,
        reason: "Học sinh chưa có lượt nộp được chọn trong báo cáo.",
        studentIds: pendingIds,
      });
    return result;
  }, [report]);
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [sending, setSending] = useState<ExamInsightActionInput["kind"] | null>(
    null,
  );

  useEffect(() => {
    if (!groups.length || groups.some((group) => group.id === groupId)) return;
    const first = groups[0];
    setGroupId(first.id);
    setTitle(`Ôn tập ${exam.subjectName}`);
    setMessage(
      `${first.reason}\n\n${analysis.recommendations[0]?.action ?? analysis.lessonPlan.objective}`,
    );
  }, [analysis, exam.subjectName, groupId, groups]);

  function selectGroup(nextId: string) {
    setGroupId(nextId);
    const group = groups.find((item) => item.id === nextId);
    if (!group) return;
    setTitle(
      group.id.startsWith("topic:")
        ? `Ôn tập: ${group.label.replace(/ \(\d+\)$/, "")}`
        : `Ôn tập ${exam.subjectName}`,
    );
    setMessage(
      `${group.reason}\n\n${analysis.recommendations[0]?.action ?? analysis.lessonPlan.objective}`,
    );
  }

  async function submit(kind: ExamInsightActionInput["kind"]) {
    const group = groups.find((item) => item.id === groupId);
    if (!group || !title.trim() || !message.trim()) return;
    setSending(kind);
    try {
      const result = await examService.createInsightAction(exam.id, {
        kind,
        studentIds: group.studentIds,
        title: title.trim(),
        message: message.trim(),
        groupLabel: group.label,
        ...(kind === "ASSIGNMENT" && dueAt
          ? { dueAt: new Date(dueAt).toISOString() }
          : {}),
      });
      notify(
        result.alreadySent
          ? "Nội dung này đã được gửi trước đó"
          : kind === "ASSIGNMENT"
            ? `Đã giao bài cho ${result.recipientCount} học sinh`
            : `Đã thông báo cho ${result.recipientCount} học sinh`,
        { key: "exam-insight-action-sent" },
      );
    } catch (cause) {
      notify(
        cause instanceof Error
          ? cause.message
          : "Không thể gửi hành động từ insight",
        { key: "exam-insight-action-error", variant: "error" },
      );
    } finally {
      setSending(null);
    }
  }

  return (
    <section
      className="rounded-lg border border-blue-200 bg-white p-4 shadow-card"
      data-testid="insight-action-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-700">
            <UsersRound className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Biến insight thành hành động</h2>
            <p className="mt-1 text-slate-500">Nhóm được tạo từ lượt có điểm cao nhất đã chấm xong và bằng chứng theo chủ đề. Giáo viên kiểm tra nội dung trước khi gửi.</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-700">
          {groups.length} nhóm gợi ý
        </span>
      </div>
      {!groups.length ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-slate-500">
          Chưa có nhóm cần can thiệp từ dữ liệu hiện tại.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <label
              className="text-xs font-bold uppercase tracking-wide text-slate-500"
              htmlFor="insight-group"
            >
              Nhóm học sinh
            </label>
            <select
              id="insight-group"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-700"
              value={groupId}
              onChange={(event) => selectGroup(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {groups.find((group) => group.id === groupId)?.reason}
            </p>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Tiêu đề
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <Textarea
              label="Nội dung đã đối chiếu"
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Hạn ôn tập (không bắt buộc)
                <input
                  type="datetime-local"
                  className="mt-1 block h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-700"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  permission="notifications.send"
                  variant="outline"
                  disabled={
                    !canSend ||
                    Boolean(sending) ||
                    !title.trim() ||
                    !message.trim()
                  }
                  onClick={() => void submit("NOTIFICATION")}
                >
                  <BellRing className="size-4" />
                  {sending === "NOTIFICATION" ? "Đang gửi..." : "Gửi thông báo"}
                </Button>
                <Button
                  permission="notifications.send"
                  disabled={
                    !canSend ||
                    Boolean(sending) ||
                    !title.trim() ||
                    !message.trim()
                  }
                  onClick={() => void submit("ASSIGNMENT")}
                >
                  <ClipboardList className="size-4" />
                  {sending === "ASSIGNMENT"
                    ? "Đang giao..."
                    : "Giao bài ôn tập"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SavedAnalysisReport({
  analysis,
  snapshot,
}: {
  analysis: ExamClassAiAnalysis;
  snapshot: ExamClassAnalysisState["snapshot"];
}) {
  const priorities = {
    HIGH: "Ưu tiên cao",
    MEDIUM: "Ưu tiên vừa",
    LOW: "Khuyến nghị",
  };
  const gaps = analysis.knowledgeGaps ?? [];
  const assessmentOnly =
    analysis.analysisScope === "ASSESSMENT_ONLY" ||
    analysis.source === "ASSESSMENT_ONLY";
  const weakQuestions = (snapshot?.questions ?? []).filter(
    (question) =>
      question.opportunityCount > 0 &&
      question.accuracy !== null &&
      question.accuracy < 60,
  );
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            {analysis.headline}
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${analysis.source === "AI" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}
          >
            {analysis.source === "AI"
              ? "Phân tích AI"
              : assessmentOnly
                ? "Chỉ dữ liệu kiểm tra"
                : "Phân tích theo quy tắc"}
          </span>
        </div>
        <p className="mt-2 max-w-6xl leading-6 text-slate-600">
          {analysis.summary}
        </p>
        {snapshot ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Tỷ lệ nộp bài</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">
                {snapshot.enrolledStudentCount
                  ? formatNumber(
                      (snapshot.submittedStudentCount /
                        snapshot.enrolledStudentCount) *
                        100,
                    )
                  : 0}
                %
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Điểm trung bình</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">
                {snapshot.averagePercentage === null
                  ? "—"
                  : `${formatNumber(snapshot.averagePercentage)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">
                {assessmentOnly
                  ? "Nguy cơ học lực yếu"
                  : "Thời gian trung bình"}
              </dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">
                {assessmentOnly
                  ? analysis.riskSummary?.atRiskPercentage === null ||
                    analysis.riskSummary?.atRiskPercentage === undefined
                    ? "—"
                    : `${formatNumber(analysis.riskSummary.atRiskPercentage)}%`
                  : snapshot.averageDurationSeconds === null
                    ? "—"
                    : `${formatNumber(snapshot.averageDurationSeconds)} giây`}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>
      {assessmentOnly ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 leading-6 text-amber-800"
        >
          Môn học chưa có tài liệu đã gắn và xử lý sẵn sàng. Báo cáo này chỉ ước
          lượng nguy cơ học lực yếu từ kết quả bài kiểm tra; hệ thống không gọi
          AI và không tạo lộ trình hay hoạt động ôn tập.
        </p>
      ) : null}
      {!assessmentOnly ? (
        <>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-bold text-slate-900">
                Kiến thức cần củng cố
              </h2>
              <p className="mt-1 text-slate-500">
                Đối chiếu nội dung, câu sai và bài tập cần ôn. Nhận định chỉ áp
                dụng cho học sinh đã nộp.
              </p>
            </header>
            {gaps.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="bg-brand-600 text-white">
                    <tr>
                      <th className="w-1/4 px-4 py-3">Kiến thức / kỹ năng</th>
                      <th className="w-1/3 px-4 py-3">Bằng chứng trong bài</th>
                      <th className="px-4 py-3">Ôn tập như thế nào?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gaps.map((gap, index) => (
                      <tr key={index} className="align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {gap.knowledge}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-brand-700">
                            Câu {gap.questionNumbers.join(", ")}
                          </p>
                          <p className="mt-1 leading-6 text-slate-500">
                            {gap.evidence}
                          </p>
                        </td>
                        <td className="px-4 py-3 leading-6 text-slate-600">
                          {gap.remediation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 leading-6 text-slate-500">
                {!snapshot?.questions
                  ? "Báo cáo cũ chưa có bằng chứng theo câu. Bấm Cập nhật phân tích để bổ sung nội dung kiến thức cụ thể."
                  : "Chưa có kết luận kiến thức cụ thể từ AI. Xem bằng chứng theo câu bên dưới trước khi đánh giá."}
              </p>
            )}
            {weakQuestions.length ? (
              <details
                className="border-t border-slate-100 px-4 py-3"
                open={!gaps.length}
              >
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Bằng chứng gốc · {weakQuestions.length} câu có tỷ lệ đúng dưới
                  60%
                </summary>
                <div className="mt-3 divide-y divide-slate-100">
                  {weakQuestions.map((question) => (
                    <article key={question.order} className="py-3 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">
                          Câu {question.order} · {question.topicName}
                        </h3>
                        <span className="text-rose-700">
                          {question.incorrectCount ?? 0} sai ·{" "}
                          {question.unansweredCount} bỏ trống /{" "}
                          {question.opportunityCount} lượt
                        </span>
                      </div>
                      <p className="mt-1 leading-6 text-slate-600">
                        {question.content || "Chưa có nội dung câu hỏi."}
                      </p>
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-card">
              <h2 className="border-b border-slate-100 px-4 py-3 font-bold text-slate-900">
                Kế hoạch hỗ trợ
              </h2>
              <ol className="divide-y divide-slate-100">
                {analysis.recommendations.map((item, index) => (
                  <li key={index} className="flex gap-3 p-4">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 font-bold text-brand-700">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-800">
                          {item.title}
                        </h3>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {priorities[item.priority]}
                        </span>
                      </div>
                      <p className="mt-1 leading-6 text-slate-500">
                        {item.action}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <details className="border-t border-slate-100 p-4">
                <summary className="cursor-pointer font-semibold text-brand-700">
                  Hoạt động trên lớp · {analysis.lessonPlan.durationMinutes}{" "}
                  phút
                </summary>
                <h3 className="mt-3 font-semibold text-slate-800">
                  {analysis.lessonPlan.focus}
                </h3>
                <p className="mt-1 leading-6 text-slate-500">
                  {analysis.lessonPlan.objective}
                </p>
                <ol className="mt-3 list-inside list-decimal space-y-2 leading-6 text-slate-600">
                  {analysis.lessonPlan.activities.map((activity, index) => (
                    <li key={index}>{activity}</li>
                  ))}
                </ol>
              </details>
            </section>
            <aside className="space-y-3">
              {[
                {
                  title: "Điểm tích cực",
                  items: analysis.strengths,
                  icon: CheckCircle2,
                  tone: "text-emerald-600",
                },
                {
                  title: "Lưu ý về dữ liệu & tham gia",
                  items: analysis.concerns,
                  icon: CircleAlert,
                  tone: "text-amber-600",
                },
              ].map(({ title, items, icon: Icon, tone }) => (
                <section
                  key={title}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"
                >
                  <h2 className="flex items-center gap-2 font-bold text-slate-900">
                    <Icon className={`size-4 ${tone}`} />
                    {title}
                  </h2>
                  <div className="mt-3 divide-y divide-slate-100">
                    {items.length ? (
                      items.map((item, index) => (
                        <article
                          key={index}
                          className="py-3 first:pt-0 last:pb-0"
                        >
                          <h3 className="font-semibold text-slate-800">
                            {item.title}
                          </h3>
                          <p className="mt-1 leading-6 text-slate-500">
                            {item.evidence}
                          </p>
                        </article>
                      ))
                    ) : (
                      <p className="text-slate-500">
                        Chưa có nhận xét đủ bằng chứng.
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </aside>
          </div>
        </>
      ) : null}
      <p className="px-1 text-xs leading-5 text-slate-400">
        Một bài kiểm tra chỉ phản ánh một phần kiến thức. Mở tab Theo dõi học
        tập theo môn để xem bằng chứng qua nhiều bài và phối hợp phụ huynh.
      </p>
    </div>
  );
}
