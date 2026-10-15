"use client";
import { useState } from "react";
import { authenticatedRequest } from "@/lib/auth-api";
import { academicDataService } from "@/lib/assessment-api";
import { usePermissions } from "@/context/permissions-context";
import type { ClassRosterMember } from "@/types/assessment";

type Recipient = { studentId: string; revision: number; learningOverride?: Record<string, unknown> | null };
type Props = { mode: "assignment" | "exam"; sourceId: string; classId: string; onSaved?: () => void };
const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const local = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value))
  ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : "";
export function LearningExceptionForm({ mode, sourceId, classId, onSaved }: Props) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [students, setStudents] = useState<ClassRosterMember[]>([]), [recipients, setRecipients] = useState<Recipient[]>([]);
  const [revision, setRevision] = useState(0), [defaults, setDefaults] = useState<Record<string, unknown>>({});
  const [studentId, setStudentId] = useState(""), [first, setFirst] = useState(""), [last, setLast] = useState("");
  const [duration, setDuration] = useState(30), [attempts, setAttempts] = useState(1), [kind, setKind] = useState("EXTENSION"), [reason, setReason] = useState("");
  if (!can(mode === "exam" ? "exams.update" : "teaching.update")) return null;
  async function load() {
    setBusy(true); setError("");
    try {
      const [roster, data] = await Promise.all([academicDataService.getTeacherAssignedClassRoster(classId),
        mode === "exam" ? authenticatedRequest<Recipient[]>(`/exams/${sourceId}/learning-exceptions`) :
          authenticatedRequest<{ assignment: Record<string, unknown>; recipients: Recipient[] }>(`/teacher/assignments/${sourceId}`)]);
      setStudents(roster.students);
      if (Array.isArray(data)) setRecipients(data);
      else { setRecipients(data.recipients); setRevision(Number(data.assignment.revision)); setDefaults(data.assignment); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được danh sách học sinh"); }
    finally { setBusy(false); }
  }
  function choose(id: string) {
    setStudentId(id); setMessage("");
    const config = recipients.find((row) => row.studentId === id)?.learningOverride ?? defaults;
    setFirst(local(config[mode === "exam" ? "startsAt" : "dueAt"]));
    setLast(local(config[mode === "exam" ? "endsAt" : "cutoffAt"]));
    setDuration(Number(config.durationMinutes ?? 30)); setAttempts(Number(config.attemptsAllowed ?? 1));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const dates = [first, last].map((value) => new Date(`${value}:00+07:00`).toISOString());
      const payload = mode === "exam" ? { revision: recipients.find((row) => row.studentId === studentId)?.revision ?? 0,
        startsAt: dates[0], endsAt: dates[1], durationMinutes: duration, attemptsAllowed: attempts, kind, reason } :
        { revision, dueAt: dates[0], cutoffAt: dates[1], reason };
      await authenticatedRequest(mode === "exam" ? `/exams/${sourceId}/students/${studentId}/exception` :
        `/teacher/assignments/${sourceId}/recipients/${studentId}/exception`, { method: "POST", body: JSON.stringify(payload) });
      setMessage("Đã cấp lịch riêng. Lịch của các học sinh khác không thay đổi.");
      await load(); onSaved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được lịch riêng"); }
    finally { setBusy(false); }
  }
  return <section className="my-3 rounded-xl border border-slate-200 bg-white p-4">
    <button type="button" aria-expanded={open} className="text-sm font-bold text-brand-700" onClick={() => {
      setOpen(!open); if (!open) void load();
    }}>{open ? "Ẩn lịch riêng" : "Gia hạn / giao bổ sung cho học sinh"}</button>
    {open ? <form onSubmit={(event) => void save(event)} className="mt-3 space-y-3">
      <p className="text-xs text-slate-500">Chỉ áp dụng cho học sinh còn trong lớp, trong học kỳ chưa khóa. Giờ Việt Nam (UTC+7).
        {mode === "exam" ? " Không dùng lại đề đã trả điểm hoặc có chính sách mở đáp án; cần tạo đề thi bù riêng. Không đổi lượt đang làm." : " Học sinh vào muộn được giao bổ sung khi lưu lịch riêng."}</p>
      <label className="block text-sm">Học sinh<select required disabled={busy} className={field} value={studentId} onChange={(event) => choose(event.target.value)}>
        <option value="">Chọn học sinh</option>{students.map((row) => <option key={row.id} value={row.id}>{row.fullName} · {row.accountName}</option>)}</select></label>
      {mode === "exam" ? <label className="block text-sm">Lý do điều chỉnh<select className={field} value={kind} onChange={(event) => setKind(event.target.value)}>
        <option value="EXTENSION">Gia hạn</option><option value="MAKEUP">Thi bù</option><option value="LATE_ENROLLMENT">Học sinh vào lớp muộn</option></select></label> : null}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{mode === "exam" ? "Bắt đầu" : "Hạn nộp đúng hạn"}<input required type="datetime-local" className={field} value={first} onChange={(event) => setFirst(event.target.value)} /></label>
        <label className="text-sm">{mode === "exam" ? "Kết thúc" : "Ngừng nhận bài"}<input required type="datetime-local" className={field} value={last} onChange={(event) => setLast(event.target.value)} /></label></div>
      {mode === "exam" ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Thời gian mỗi lượt (phút)<input required type="number" min={1} max={1440} className={field} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <label className="text-sm">Tổng số lượt được phép (gồm lượt đã dùng)<input required type="number" min={1} max={1000} className={field} value={attempts} onChange={(event) => setAttempts(Number(event.target.value))} /></label></div> : null}
      <label className="block text-sm">Ghi rõ lý do<textarea required minLength={3} maxLength={1000} className={field} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {error ? <p role="alert" className="text-sm text-rose-700">{error} Hãy đóng rồi mở lại để tải lịch mới nhất nếu có xung đột.</p> : null}
      {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={busy || !studentId || !students.length} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : "Lưu lịch riêng"}</button>
    </form> : null}
  </section>;
}
