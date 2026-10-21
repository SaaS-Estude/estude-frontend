"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form-control";
import { onlineSessionApi, type OnlineRole, type OnlineSession, type OnlineSessionInput, type OnlineRoster } from "@/lib/online-sessions-api";
import { onlineLocalInput, onlineUTC } from "@/lib/online-session-view";
import { useAuth } from "@/context/auth-context";

export function OnlineSessionEditor({ role, courseId, courseName, session, onClose, onSaved }: {
  role: OnlineRole; courseId: string; courseName: string; session?: OnlineSession; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [roster, setRoster] = useState<OnlineRoster | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const lock = useRef(false);
  const [form, setForm] = useState<OnlineSessionInput>(() => ({
    requestKey: crypto.randomUUID(), revision: session?.revision ?? 0, organizerId: session?.organizerId ?? (role === "teacher" ? user?.id ?? "" : ""),
    title: session?.title ?? "", description: session?.description ?? "", platform: session?.platform ?? "MEET", meetingUrl: session?.meetingUrl ?? "",
    meetingPasscode: session?.meetingPasscode ?? "",
    startsAt: onlineLocalInput(session?.startsAt ?? new Date(Date.now() + 3600000).toISOString()),
    endsAt: onlineLocalInput(session?.endsAt ?? new Date(Date.now() + 7200000).toISOString()),
    audience: session?.audience ?? "ALL", status: session?.status === "DRAFT" ? "DRAFT" : "SCHEDULED", studentIds: session?.studentIds ?? [],
  }));
  useEffect(() => { let active = true; onlineSessionApi.roster(role, courseId).then((data) => { if (active) setRoster(data); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được học sinh"); }); return () => { active = false; }; }, [role, courseId]);
  function patch<K extends keyof OnlineSessionInput>(key: K, value: OnlineSessionInput[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current || !roster) return;
    if (Date.parse(onlineUTC(form.endsAt)) <= Date.parse(onlineUTC(form.startsAt))) { setError("Giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (form.audience === "SELECTED" && !form.studentIds.length) { setError("Chọn ít nhất một học sinh."); return; }
    lock.current = true; setBusy(true); setError("");
    try { await onlineSessionApi.save(role, courseId, session?.id, { ...form, startsAt: session && form.startsAt === onlineLocalInput(session.startsAt) ? session.startsAt : onlineUTC(form.startsAt), endsAt: session && form.endsAt === onlineLocalInput(session.endsAt) ? session.endsAt : onlineUTC(form.endsAt), studentIds: form.audience === "ALL" ? [] : form.studentIds }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được buổi học"); }
    finally { lock.current = false; setBusy(false); }
  }
  const students = roster?.students.filter((student) => `${student.fullName} ${student.accountName}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))) ?? [];
  return <Modal open title={session ? "Chỉnh sửa buổi học online" : "Tạo buổi học online"} description={courseName} onClose={() => { if (!busy) onClose(); }} width="max-w-2xl" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Hủy</Button><Button form="online-session-editor" type="submit" disabled={busy || !roster}>{busy ? "Đang lưu…" : "Xác nhận"}</Button></>}>
    <form id="online-session-editor" onSubmit={save} className="space-y-4">
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {!roster ? <p className="text-sm text-slate-500">Đang tải danh sách lớp môn học…</p> : null}
      <fieldset disabled={busy} className="space-y-4">
        <Input label="Tên buổi học" value={form.title} required minLength={2} maxLength={200} placeholder="Ví dụ: Ôn tập phương trình bậc hai" onChange={(e) => patch("title", e.target.value)} />
        <Textarea label="Nội dung / mục tiêu rèn luyện" value={form.description} maxLength={4000} rows={3} onChange={(e) => patch("description", e.target.value)} />
        {role === "admin" ? <Select label="Giáo viên tổ chức" required value={form.organizerId} onChange={(e) => patch("organizerId", e.target.value)}><option value="">Chọn giáo viên được phân công</option>{roster?.teachers.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</Select> : null}
        <div className="grid gap-4 sm:grid-cols-2"><Select label="Nền tảng" value={form.platform} onChange={(e) => setForm((current) => ({ ...current, platform: e.target.value as "MEET" | "ZOOM", meetingPasscode: e.target.value === "MEET" ? "" : current.meetingPasscode }))}><option value="MEET">Google Meet</option><option value="ZOOM">Zoom</option></Select><Select label="Trạng thái" value={form.status} onChange={(e) => patch("status", e.target.value as "DRAFT" | "SCHEDULED")}><option value="SCHEDULED">Đã lên lịch</option>{!session || session.status === "DRAFT" ? <option value="DRAFT">Bản nháp</option> : null}</Select></div>
        <Input label="Đường dẫn tham gia" type="url" required={form.status === "SCHEDULED"} value={form.meetingUrl} placeholder={form.platform === "MEET" ? "https://meet.google.com/…" : "https://…zoom.us/j/…"} maxLength={2048} onChange={(e) => patch("meetingUrl", e.target.value)} hint="Tạo phòng trên Zoom hoặc Google Meet rồi dán đường dẫn tham gia tại đây." />
        {form.platform === "ZOOM" ? <Input label="Mật khẩu tham gia (không bắt buộc)" value={form.meetingPasscode ?? ""} autoComplete="off" spellCheck={false} maxLength={128} placeholder="Nhập mật khẩu phòng Zoom nếu có" onChange={(event) => patch("meetingPasscode", event.target.value)} hint="Nhập mật khẩu đã đặt trên Zoom. Có thể để trống nếu đường dẫn mời đã kèm mật khẩu. Học sinh nhận mật khẩu khi bấm Vào học." /> : <p className="text-xs text-slate-500">Google Meet tham gia bằng đường dẫn hoặc mã cuộc họp, không cần nhập mật khẩu phòng riêng tại đây.</p>}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Bắt đầu (giờ Việt Nam)" type="datetime-local" required value={form.startsAt} onChange={(e) => patch("startsAt", e.target.value)} /><Input label="Kết thúc (giờ Việt Nam)" type="datetime-local" required value={form.endsAt} onChange={(e) => patch("endsAt", e.target.value)} /></div>
        <Select label="Đối tượng tham gia" value={form.audience} onChange={(e) => patch("audience", e.target.value as "ALL" | "SELECTED")}><option value="ALL">Cả lớp môn học</option><option value="SELECTED">Chọn nhóm học sinh</option></Select>
        {form.audience === "SELECTED" ? <div className="space-y-2 rounded-xl border border-slate-200 p-3"><Input aria-label="Tìm học sinh tham gia" placeholder="Tìm theo tên hoặc mã học sinh" value={search} onChange={(e) => setSearch(e.target.value)} /><p className="text-xs text-slate-500">Đã chọn {form.studentIds.length} học sinh</p><div className="max-h-48 overflow-y-auto">{students.map((student) => <label key={student.id} className="flex items-center gap-3 border-b border-slate-100 py-2 text-sm"><Checkbox checked={form.studentIds.includes(student.id)} onChange={(e) => patch("studentIds", e.target.checked ? [...form.studentIds, student.id] : form.studentIds.filter((id) => id !== student.id))} /><span>{student.fullName} <span className="text-xs text-slate-400">{student.accountName}</span></span></label>)}{!students.length ? <p className="py-3 text-sm text-slate-500">Không có học sinh phù hợp.</p> : null}{form.studentIds.filter((id) => !roster?.students.some((student) => student.id === id)).map((id) => <label key={id} className="flex items-center gap-3 py-2 text-sm text-amber-700"><Checkbox checked onChange={() => patch("studentIds", form.studentIds.filter((value) => value !== id))} /><span>Học sinh đã rời lớp — bỏ chọn để lưu thay đổi.</span></label>)}</div></div> : null}
      </fieldset>
    </form>
  </Modal>;
}
