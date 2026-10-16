"use client";
import { assessmentPurposeLabels, type AssessmentPurpose } from "@/lib/internal-results";

import { useState } from "react";
import Link from "next/link";
import { gradebookService } from "@/lib/gradebook-api";
import type { GradebookView, GradeItem, StudentGrade } from "@/types/gradebook";

const label = {
  ASSIGNMENT: "Bài tập",
  EXAM: "Bài kiểm tra",
  MANUAL: "Thủ công",
  LEGACY: "Điểm cũ",
};
const statusLabel = {
  NOT_GRADED: "Chưa chấm",
  GRADED: "Đã chấm",
  MISSING: "Chưa nộp",
  EXCUSED: "Được miễn",
};
const field = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm";

function gradeText(grade: StudentGrade | undefined, maxScore: number) {
  if (!grade) return "Chưa chấm";
  if (grade.derived) return statusLabel[grade.evaluationStatus];
  const current = grade.evaluationStatus === "GRADED"
    ? `${grade.rawScore ?? grade.assessmentValue ?? "—"}/${maxScore}`
    : statusLabel[grade.evaluationStatus];
  const published = grade.publishedAt
    ? grade.publishedEvaluationStatus === "GRADED"
      ? `${grade.publishedRawScore ?? grade.publishedAssessmentValue ?? "—"}/${maxScore}`
      : statusLabel[grade.publishedEvaluationStatus ?? "NOT_GRADED"]
    : null;
  return published ? `Hiện tại: ${published}${grade.publicationStatus === "DRAFT" ? ` · Nháp: ${current}` : ""}` : `Nháp: ${current}`;
}

export function UnifiedGradeItems({ view, disabled, onChanged, onError, internal = false, allowPlanning = false }: {
  view: GradebookView;
  internal?: boolean;
 allowPlanning?: boolean;
  disabled: boolean;
  onChanged: (notice: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState<AssessmentPurpose>("REGULAR");
  const [feedback, setFeedback] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [busy, setBusy] = useState(false);
  const [mappingReason, setMappingReason] = useState("");
  const [editing, setEditing] = useState<{ item: GradeItem; studentId: string; grade?: StudentGrade } | null>(null);
  const [evaluation, setEvaluation] = useState<"NOT_GRADED" | "GRADED" | "MISSING" | "EXCUSED">("GRADED");
  const [score, setScore] = useState("");
  const [assessment, setAssessment] = useState<"PASS" | "FAIL" | "">("");
  const [reason, setReason] = useState("");
  const canCreate = (!disabled || allowPlanning) && ['ACTIVE', 'UPCOMING'].includes(view.term.status);
  const book = view.book;
  if (!book) return null;
  const slots = [
    ...Array.from({ length: view.requiredRegular ?? 0 }, (_, index) => `TX${index + 1}`),
    "GK", "CK",
  ];
  async function createItem() {
    if (!book || !canCreate || !title.trim()) return;
    setBusy(true);
    try {
      await gradebookService.createManualItem(book.id, { title: title.trim(), maxScore: Number(maxScore), assessmentPurpose: purpose });
      setTitle("");
      onChanged("Đã tạo hoạt động đánh giá thủ công.");
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không tạo được GradeItem"); }
    finally { setBusy(false); }
  }
  async function map(item: GradeItem, slotKey: string) {
    if (!book || disabled || !mappingReason.trim()) {
      onError("Hãy nhập lý do ánh xạ cột điểm trước khi thay đổi.");
      return;
    }
    setBusy(true);
    try {
      await gradebookService.mapSlot(book.id, item.id, slotKey || null, mappingReason.trim());
      onChanged("Đã cập nhật cột điểm chính thức.");
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không ánh xạ được cột điểm"); }
    finally { setBusy(false); }
  }
  function open(item: GradeItem, studentId: string, grade?: StudentGrade) {
    if (item.sourceType !== "MANUAL" || disabled) return;
    setEditing({ item, studentId, grade });
    setEvaluation(grade?.evaluationStatus ?? "GRADED");
    setScore(grade?.rawScore === null || grade?.rawScore === undefined ? "" : String(grade.rawScore));
    setAssessment(grade?.assessmentValue ?? "");
    setReason("");
    setFeedback(grade?.feedback ?? "");
  }
  async function save(publish: boolean) {
    if (!book || !editing || disabled || !reason.trim()) {
      onError("Hãy nhập lý do lưu hoặc công bố điểm.");
      return;
    }
    const value = evaluation === "GRADED" && book.assessmentMode === "NUMERIC" && score !== "" ? Number(score) : null;
    if (evaluation === "GRADED" && book.assessmentMode === "NUMERIC" && (value === null || !Number.isFinite(value))) {
      onError("Cần nhập điểm hợp lệ."); return;
    }
    setBusy(true);
    try {
      await gradebookService.saveManualGrade(book.id, editing.item.id, {
        studentId: editing.studentId, evaluationStatus: evaluation,
        score: value, assessment: evaluation === "GRADED" && book.assessmentMode === "COMMENT" ? assessment || null : null,
        publish, feedback, reason: reason.trim(),
      });
      setEditing(null);
      onChanged(publish ? "Đã công bố điểm thủ công." : "Đã lưu điểm nháp; học sinh chưa thấy.");
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không lưu được điểm"); }
    finally { setBusy(false); }
  }
  return <div className="m-3 space-y-3 rounded-xl border border-slate-200 p-4">
    <div>
      <h3 className="font-bold text-slate-900">Điểm theo hoạt động</h3>
      <p className="text-xs text-slate-500">Điểm bài tập/kiểm tra được sửa ở hoạt động gốc. Điểm nháp được giữ riêng với kết quả đã công bố cho học sinh và phụ huynh.</p>
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">Tên điểm thủ công<input className={field} value={title} maxLength={160} disabled={!canCreate || busy} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="grid gap-1 text-xs">Điểm tối đa<input className={`${field} w-24`} type="number" min="0.01" max="1000" step="0.01" value={maxScore} disabled={!canCreate || busy} onChange={(event) => setMaxScore(event.target.value)} /></label>
      <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" disabled={!canCreate || busy || title.trim().length < 2} onClick={() => void createItem()}>Tạo hoạt động</button>
      <label className="grid gap-1 text-xs">Mục đích<select className={field} value={purpose} disabled={!canCreate || busy} onChange={(e) => setPurpose(e.target.value as AssessmentPurpose)}>{Object.entries(assessmentPurposeLabels).filter(([id]) => id !== 'LEGACY_REVIEW').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {!internal ? <label className="grid min-w-56 flex-1 gap-1 text-xs">Lý do ánh xạ cột<input className={field} value={mappingReason} maxLength={500} disabled={disabled || busy} onChange={(event) => setMappingReason(event.target.value)} placeholder="Bắt buộc khi thay đổi TX/GK/CK" /></label> : null}
    </div>
    {view.items.length ? <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-xs">
      <thead><tr className="bg-slate-50"><th className="sticky left-0 min-w-40 bg-slate-50 p-2">Học sinh</th>{view.items.map((item) => <th key={item.id} className="min-w-52 p-2 align-top">
        <div className="font-semibold">{item.title}</div><div className="font-normal text-slate-500">{label[item.sourceType]} · tối đa {item.maxScore} · {item.status === "ARCHIVED" ? "Lưu trữ" : item.status === "PENDING_GRADEBOOK_CONFIGURATION" ? "Chờ cấu hình" : "Hoạt động"}</div>
        {item.sourceType === "EXAM" && item.sourceId ? <Link className="text-brand-700 underline" href={`/teacher/exams/${item.sourceId}/submissions`}>Mở bài kiểm tra</Link> : null}
        {item.sourceType === "ASSIGNMENT" ? <span className="block text-slate-500">Mở bài tập trong nội dung lớp</span> : null}
        <p className="text-xs text-slate-500">{assessmentPurposeLabels[item.assessmentPurpose ?? "LEGACY_REVIEW"]}</p>
        {!internal ? <select aria-label={`Cột điểm chính thức của ${item.title}`} className={`${field} mt-1 w-full`} value={item.officialSlot ?? ""} disabled={disabled || busy} onChange={(event) => void map(item, event.target.value)}>
          <option value="">Chưa tính vào TX/GK/CK</option>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
        </select> : null}
      </th>)}</tr></thead>
      <tbody>{view.students.map((student) => <tr key={student.id} className="border-t border-slate-100"><td className="sticky left-0 bg-white p-2 font-semibold">{student.fullName}</td>{view.items.map((item) => {
        const grade = student.itemGrades.find((row) => row.gradeItemId === item.id);
        return <td key={item.id} className="p-2"><button type="button" className={`text-left ${item.sourceType === "MANUAL" && !disabled ? "text-brand-700 underline" : "cursor-default text-slate-600"}`} disabled={item.sourceType !== "MANUAL" || disabled} onClick={() => open(item, student.id, grade)}>{gradeText(grade, item.maxScore)}</button></td>;
      })}</tr>)}</tbody>
    </table></div> : <p className="text-sm text-slate-500">Chưa có GradeItem trong học kỳ này.</p>}
    {editing ? <div className="flex flex-wrap items-end gap-2 rounded-lg bg-blue-50 p-3 text-sm">
      <span className="font-semibold">{editing.item.title} · {view.students.find((row) => row.id === editing.studentId)?.fullName}</span>
      <label className="grid gap-1 text-xs">Trạng thái<select className={field} value={evaluation} onChange={(event) => setEvaluation(event.target.value as typeof evaluation)}><option value="GRADED">Đã chấm</option><option value="NOT_GRADED">Chưa chấm</option><option value="MISSING">Chưa nộp</option><option value="EXCUSED">Được miễn</option></select></label>
      {evaluation === "GRADED" ? book.assessmentMode === "NUMERIC" ? <label className="grid gap-1 text-xs">Điểm<input className={`${field} w-24`} type="number" min="0" max={editing.item.maxScore} step="0.01" value={score} onChange={(event) => setScore(event.target.value)} /></label> : <label className="grid gap-1 text-xs">Đánh giá<select className={field} value={assessment} onChange={(event) => setAssessment(event.target.value as typeof assessment)}><option value="">Chọn</option><option value="PASS">Đạt</option><option value="FAIL">Chưa đạt</option></select></label> : null}
      <label className="grid min-w-48 flex-1 gap-1 text-xs">Nhận xét<input className={field} maxLength={10000} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></label>
      <label className="grid min-w-48 flex-1 gap-1 text-xs">Lý do<input className={field} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <button type="button" className="rounded-lg border border-brand-600 px-3 py-2 font-semibold text-brand-700" disabled={busy} onClick={() => void save(false)}>Lưu nháp</button>
      <button type="button" className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white" disabled={busy} onClick={() => void save(true)}>Công bố</button>
      <button type="button" className="px-2 py-2 text-slate-600" disabled={busy} onClick={() => setEditing(null)}>Hủy</button>
    </div> : null}
  </div>;
}
