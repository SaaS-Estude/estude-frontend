"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { examService, learningPlanService } from "@/lib/assessment-api";
import type { AssessmentEvidenceRecord, Exam, LearningImprovementProfile, LearningReassessment } from "@/types/assessment";

const sourceLink = (item: AssessmentEvidenceRecord) => `/teacher/exams/${item.examId}/submissions/${item.sourceAttemptId}`;
const date = (value: string) => new Date(value).toLocaleString("vi-VN");
const statusText: Record<string, string> = {
  INSUFFICIENT_EVIDENCE: "Chưa đủ bằng chứng", IMPROVED_NOT_MET: "Có cải thiện, chưa đạt",
  ACHIEVED_TARGET: "Đạt ngưỡng đã đặt", NO_IMPROVEMENT: "Chưa cải thiện / giảm",
};

export function TeacherImprovementPanel({ planId, onChanged }: { planId: string; onChanged?: () => Promise<void> }) {
  const [profile, setProfile] = useState<LearningImprovementProfile | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [next, allExams] = await Promise.all([learningPlanService.getTeacherImprovement(planId), examService.getExams()]);
    setProfile(next);
    setExams(allExams.filter((exam) => exam.published && exam.classId === next.plan.classId && exam.subjectId === next.plan.subjectId));
  }
  useEffect(() => {
    let active = true;
    Promise.all([learningPlanService.getTeacherImprovement(planId), examService.getExams()]).then(([next, allExams]) => {
      if (!active) return;
      setProfile(next);
      setExams(allExams.filter((exam) => exam.published && exam.classId === next.plan.classId && exam.subjectId === next.plan.subjectId));
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải hồ sơ cải thiện"); });
    return () => { active = false; };
  }, [planId]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); await reload(); await onChanged?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật đánh giá"); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-4 border-t pt-4">
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p> : null}
    {!profile ? <p className="text-slate-500">Đang tải hồ sơ cải thiện...</p> : <>
      <div className="rounded-lg bg-blue-50 p-3"><p className="font-bold">Mốc ban đầu · mục tiêu {profile.plan.objective?.title ?? profile.plan.objectiveId}</p>
        {profile.baseline ? <p className="mt-1">{profile.baseline.correctCount}/{profile.baseline.scorableCount} câu · {profile.baseline.accuracy}% · tự làm · {date(profile.baseline.observedAt)} · <Link className="text-brand-700 underline" href={sourceLink(profile.baseline)}>Mở bài và câu nguồn</Link></p> : <p>Thiếu mốc ban đầu đã xác nhận.</p>}
        <p className="mt-1">Tiêu chí đặt trước: {profile.plan.successCriteria} · ngưỡng {profile.plan.targetAccuracyPercent ?? "chưa có"}%</p>
      </div>
      {(["AFTER", "RETENTION"] as const).map((phase) => {
        const assignment = profile.reassessments.find((item) => item.phase === phase);
        const canAssign = phase === "AFTER" ? profile.plan.status === "WAITING_REASSESSMENT" : profile.plan.status === "ACHIEVED";
        return <section key={phase} className="rounded-xl border p-4"><h4 className="font-black">{phase === "AFTER" ? "Đánh giá sau lộ trình" : "Kiểm tra duy trì"}</h4>
          {assignment ? <div className="mt-2 space-y-1 text-sm"><p>Đề đã giao: {exams.find((exam) => exam.id === assignment.examId)?.title ?? assignment.examId} · tối thiểu {assignment.minimumQuestions} câu · {assignment.dueAt ? `hạn ${date(assignment.dueAt)}` : "không có hạn"}</p><p>Căn cứ tương đương: {assignment.equivalenceRationale}</p><p>{assignment.candidates.length} bài đã nộp đúng mục tiêu; {assignment.reviewedAt ? `giáo viên xử lý ${date(assignment.reviewedAt)}` : "chưa xác nhận"}</p></div> : <p className="mt-1 text-sm text-slate-500">Chưa giao bài đánh giá.</p>}
          {canAssign && (!assignment?.reviewedAt || assignment.computedStatus === "INSUFFICIENT_EVIDENCE") ? <AssignmentForm phase={phase} exams={exams} profile={profile} assignment={assignment} busy={busy} onAssign={(input) => run(() => learningPlanService.assignReassessment(planId, phase, input))} /> : null}
          {assignment ? <AssignmentResult assignment={assignment} baseline={profile.baseline} busy={busy} onReview={(input) => run(() => learningPlanService.reviewReassessment(planId, phase, input))} /> : null}
        </section>;
      })}
      <details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">Dòng thời gian bằng chứng ({profile.timeline.length})</summary><ol className="mt-2 space-y-1 text-sm">{profile.timeline.map((item, index) => <li key={`${item.kind}-${index}`}>{date(item.at)} · {item.label}{item.evidenceId ? ` · ${item.evidenceId}` : ""}</li>)}</ol></details>
    </>}
  </div>;
}

function AssignmentForm({ phase, exams, profile, assignment, busy, onAssign }: {
  phase: "AFTER" | "RETENTION"; exams: Exam[]; profile: LearningImprovementProfile; assignment?: LearningReassessment;
  busy: boolean; onAssign: (input: { examId: string; minimumQuestions: number; equivalenceRationale: string; scheduledFor?: string; dueAt?: string; expectedPlanVersion: number; expectedVersion?: number }) => Promise<void>;
}) {
  const [examId, setExamId] = useState(assignment?.examId ?? "");
  const [minimumQuestions, setMinimumQuestions] = useState(assignment?.minimumQuestions ?? 3);
  const [rationale, setRationale] = useState(assignment?.equivalenceRationale ?? "");
  const [scheduledFor, setScheduledFor] = useState("");
  const [dueAt, setDueAt] = useState("");
  return <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm"><p>Chọn đề mới đã công bố, cùng lớp/môn/mục tiêu. Hệ thống sẽ kiểm tra câu trùng và số câu; giáo viên vẫn phải duyệt độ khó tương đương sau khi học sinh nộp.</p>
    <select aria-label={`Chọn đề ${phase}`} className="w-full rounded-lg border p-2" value={examId} onChange={(event) => setExamId(event.target.value)}><option value="">Chọn bài kiểm tra mới</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select>
    <label className="block">Số câu chấm được tối thiểu cho mỗi mốc<input type="number" min="2" max="50" className="mt-1 w-full rounded-lg border p-2" value={minimumQuestions} onChange={(event) => setMinimumQuestions(Number(event.target.value))} /></label>
    <label className="block">Căn cứ chọn đề tương đương<textarea className="mt-1 w-full rounded-lg border p-2" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Phạm vi, dạng câu và mức khó so với mốc đầu" /></label>
    <div className="grid gap-2 md:grid-cols-2"><label>Ngày dự kiến {phase === "RETENTION" ? "duy trì" : "đánh giá"}<input type="datetime-local" className="mt-1 w-full rounded-lg border p-2" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label><label>Hạn nộp<input type="datetime-local" className="mt-1 w-full rounded-lg border p-2" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div>
    <Button size="sm" disabled={busy || !examId || !rationale.trim() || minimumQuestions < 2} onClick={() => void onAssign({ examId, minimumQuestions, equivalenceRationale: rationale,
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      expectedPlanVersion: profile.plan.version, expectedVersion: assignment?.version })}>{assignment ? "Đổi đề chưa xác nhận" : "Giao bài đánh giá"}</Button>
  </div>;
}

function AssignmentResult({ assignment, baseline, busy, onReview }: {
  assignment: LearningReassessment; baseline: AssessmentEvidenceRecord | null; busy: boolean;
  onReview: (input: { evidenceId: string; equivalenceConfirmed: boolean; decision: "CONFIRMED" | "NEEDS_ADJUSTMENT"; reason: string; expectedVersion: number }) => Promise<void>;
}) {
  const [evidenceId, setEvidenceId] = useState(assignment.evidenceId ?? "");
  const [equivalent, setEquivalent] = useState(false);
  const [decision, setDecision] = useState<"CONFIRMED" | "NEEDS_ADJUSTMENT">("CONFIRMED");
  const [reason, setReason] = useState("");
  const selected = assignment.candidates.find((item) => item.id === evidenceId);
  return <div className="mt-3 space-y-3">
    {assignment.candidates.length ? <><select className="w-full rounded-lg border p-2" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} aria-label="Chọn bài làm sau"><option value="">Chọn lượt đã nộp để đối chiếu</option>{assignment.candidates.map((item) => <option key={item.id} value={item.id}>{date(item.observedAt)} · {item.correctCount}/{item.scorableCount} · {item.accuracy ?? "chưa chấm"}%</option>)}</select>
      {selected ? <div className="rounded-lg bg-blue-50 p-3"><p>Trước: {baseline?.correctCount ?? "?"}/{baseline?.scorableCount ?? "?"} ({baseline?.accuracy ?? "?"}%) · Sau: {selected.correctCount}/{selected.scorableCount} ({selected.accuracy ?? "?"}%)</p><p className="mt-1">Điều kiện sau: {selected.assistance} · {selected.gradingStatus} · {selected.snapshotOrigin} · quy tắc {selected.gradingVersion}</p><p className="mt-1">Mức khó trước: {JSON.stringify(baseline?.questionSnapshot.map((item) => item.difficulty) ?? [])} · sau: {JSON.stringify(selected.questionSnapshot.map((item) => item.difficulty))}</p><div className="mt-1 flex gap-3"><Link className="text-brand-700 underline" href={sourceLink(selected)}>Mở bài sau</Link>{baseline ? <Link className="text-brand-700 underline" href={sourceLink(baseline)}>Mở bài đầu</Link> : null}</div></div> : null}
      <label className="flex items-center gap-2"><input type="checkbox" checked={equivalent} onChange={(event) => setEquivalent(event.target.checked)} /> Tôi đã đối chiếu phạm vi, dạng câu và độ khó tương đương</label>
      <select className="rounded-lg border p-2" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="CONFIRMED">Xác nhận kết quả theo ngưỡng</option><option value="NEEDS_ADJUSTMENT">Cần điều chỉnh</option></select>
      <textarea className="w-full rounded-lg border p-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do quyết định hoặc lý do chưa tương đương" />
      <Button size="sm" disabled={busy || !selected || !reason.trim() || (!equivalent && decision === "CONFIRMED")} onClick={() => void onReview({ evidenceId, equivalenceConfirmed: equivalent, decision, reason, expectedVersion: assignment.version })}>Lưu quyết định giáo viên</Button>
    </> : <p className="text-amber-700">Chưa có bài đánh giá đã nộp. Bài chưa nộp không tính là 0 điểm.</p>}
    {assignment.reviewedAt ? <div className="rounded-lg bg-emerald-50 p-3"><p className="font-bold">{statusText[assignment.computedStatus ?? ""] ?? assignment.computedStatus} · {assignment.decisionReason}</p>{assignment.comparison.deltaPercentagePoints !== null ? <p>Thay đổi {assignment.comparison.deltaPercentagePoints >= 0 ? "+" : ""}{assignment.comparison.deltaPercentagePoints} điểm phần trăm trên cùng mục tiêu.</p> : null}{assignment.comparison.reasons.length ? <p>Thiếu căn cứ: {assignment.comparison.reasons.join("; ")}</p> : null}{assignment.commentary ? <p className="mt-2 whitespace-pre-wrap">{assignment.commentary} · {assignment.commentarySource}</p> : null}</div> : null}
    {assignment.history.length ? <details><summary className="cursor-pointer">Lịch sử giao/duyệt ({assignment.history.length})</summary>{assignment.history.map((item) => <p key={item.id}>v{item.version} · {date(item.changedAt)} · {item.reason}</p>)}</details> : null}
  </div>;
}
