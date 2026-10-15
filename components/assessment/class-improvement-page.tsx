"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AssessmentShell, ErrorPanel } from "@/components/assessment/assessment-shell";
import { Button } from "@/components/ui/button";
import { examService, learningPlanService } from "@/lib/assessment-api";
import type { ClassImprovementReport, Exam } from "@/types/assessment";

const retentionLabels: Record<ClassImprovementReport["rows"][number]["retentionStatus"], string> = {
  NOT_SCHEDULED: "Chưa giao",
  NOT_YET_TESTED: "Chưa kiểm tra",
  AWAITING_TEACHER: "Chờ giáo viên duyệt",
  CONFIRMED: "Đã xác nhận duy trì",
  INSUFFICIENT_EVIDENCE: "Chưa đủ bằng chứng",
  NEEDS_ADJUSTMENT: "Cần điều chỉnh",
};

export function ClassImprovementPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [report, setReport] = useState<ClassImprovementReport | null>(null);
  const [allRows, setAllRows] = useState<ClassImprovementReport["rows"]>([]);
  const [objectiveId, setObjectiveId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([examService.getExamById(id), examService.getExams()]).then(async ([value, allExams]) => {
      const next = await learningPlanService.classImprovementReport({ classId: value.classId, subjectId: value.subjectId });
      if (active) { setExam(value); setExams(allExams); setClassId(value.classId); setSubjectId(value.subjectId); setReport(next); setAllRows(next.rows); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải báo cáo cải thiện"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function apply() {
    if (!classId || !subjectId) return;
    setLoading(true); setError("");
    try { const next = await learningPlanService.classImprovementReport({ classId, subjectId,
      objectiveId: objectiveId || undefined, cohortId: cohortId || undefined,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined }); setReport(next);
      if (!objectiveId && !cohortId) setAllRows(next.rows); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lọc báo cáo"); }
    finally { setLoading(false); }
  }
  const objectiveOptions = [...new Map(allRows.map((row) => [row.objectiveId, row.objectiveTitle] as const)).entries()];
  const cohortOptions = [...new Set(allRows.map((row) => row.cohortId))];
  const classOptions = [...new Map(exams.map((item) => [item.classId, item.className] as const)).entries()];
  const subjectOptions = [...new Map(exams.filter((item) => item.classId === classId).map((item) => [item.subjectId, item.subjectName] as const)).entries()];
  return <AssessmentShell><div className="mx-auto max-w-6xl space-y-5">
    <Link href={`/teacher/exams/${id}/submissions`} className="text-sm font-semibold text-brand-700 underline">Quay lại kết quả bài kiểm tra</Link>
    <div><h1 className="text-2xl font-black">Báo cáo cải thiện của lớp</h1><p className="text-sm text-slate-500">{classOptions.find(([value]) => value === classId)?.[1] ?? exam?.className} · {subjectOptions.find(([value]) => value === subjectId)?.[1] ?? exam?.subjectName}. Chỉ so sánh cặp bài tự làm cùng mục tiêu đã được giáo viên xác nhận tương đương.</p></div>
    {error ? <ErrorPanel message={error} /> : null}
    <div className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Lớp<select className="mt-1 w-full rounded-lg border p-2" value={classId} onChange={(event) => { const next = event.target.value; setClassId(next); setSubjectId(exams.find((item) => item.classId === next)?.subjectId ?? ""); setObjectiveId(""); setCohortId(""); }}><option value="">Chọn lớp</option>{classOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Môn<select className="mt-1 w-full rounded-lg border p-2" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setObjectiveId(""); setCohortId(""); }}><option value="">Chọn môn</option>{subjectOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Giao từ ngày<input type="date" className="mt-1 w-full rounded-lg border p-2" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-sm">Giao đến ngày<input type="date" className="mt-1 w-full rounded-lg border p-2" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="text-sm">Mục tiêu<select className="mt-1 w-full rounded-lg border p-2" value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)}><option value="">Tất cả</option>{objectiveOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Nhóm đã giao<select className="mt-1 w-full rounded-lg border p-2" value={cohortId} onChange={(event) => setCohortId(event.target.value)}><option value="">Tất cả</option>{cohortOptions.map((value) => <option key={value} value={value}>{value.slice(-8)}</option>)}</select></label><Button className="self-end" disabled={loading || !classId || !subjectId} onClick={() => void apply()}>Lọc báo cáo</Button></div>
    {loading ? <p>Đang tải...</p> : null}
    {report ? <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Đã giao", report.counts.assigned], ["Đang học", report.counts.inProgress], ["Quá hạn", report.counts.overdue], ["Chờ đánh giá", report.counts.waitingReassessment],
      ["Đạt mục tiêu", report.counts.achieved], ["Cần điều chỉnh", report.counts.needsAdjustment], ["Thiếu bằng chứng", report.counts.insufficientEvidence], ["Chờ giáo viên", report.counts.awaitingTeacher],
    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div>)}</div>
      <section className="rounded-xl border bg-white p-4"><h2 className="font-black">So sánh trên cùng nhóm đủ cặp</h2><p className="mt-1">{report.denominator.pairedStudents}/{report.denominator.assignedPlans} học sinh có cặp hợp lệ đã duyệt · Bao phủ {report.reassessmentCoverage ?? "—"}% · Tỷ lệ đạt trong nhóm đã đánh giá {report.achievedRateAmongPaired ?? "—"}%</p><p>Thay đổi trung bình từng em: {report.averagePairedChange === null ? "Chưa đủ cặp" : `${report.averagePairedChange >= 0 ? "+" : ""}${report.averagePairedChange} điểm phần trăm`}</p><p className="mt-2 text-xs text-slate-500">{report.method}</p></section>
      <section className="overflow-x-auto rounded-xl border bg-white p-4"><h2 className="font-black">Từng học sinh và mục tiêu</h2><table className="mt-3 w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Học sinh</th><th className="p-2">Mục tiêu</th><th className="p-2">Nhiệm vụ</th><th className="p-2">Trước → sau</th><th className="p-2">Trạng thái</th><th className="p-2">Duy trì</th><th className="p-2">Hồ sơ</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.planId} className="border-b"><td className="p-2">{row.studentName}</td><td className="p-2">{row.objectiveTitle}</td><td className="p-2">{row.taskCompleted}/{row.taskTotal}{row.overdue ? " · quá hạn" : ""}</td><td className="p-2">{row.paired ? `${row.baselineAccuracy}% → ${row.afterAccuracy}% (${row.deltaPercentagePoints! >= 0 ? "+" : ""}${row.deltaPercentagePoints} đpt)` : "Chưa đủ cặp đã duyệt"}</td><td className="p-2">{row.status}</td><td className="p-2">{retentionLabels[row.retentionStatus]}</td><td className="p-2"><Link href={`/teacher/learning-plans/${row.planId}`} className="text-brand-700 underline">Mở bằng chứng</Link></td></tr>)}</tbody></table>{!report.rows.length ? <p className="mt-3 text-slate-500">Không có lộ trình trong phạm vi lọc.</p> : null}</section>
    </> : null}
  </div></AssessmentShell>;
}
