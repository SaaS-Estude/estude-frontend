"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssessmentShell, PageHeading } from '@/components/assessment/assessment-shell';
import { Button } from '@/components/ui/button';
import { academicDataService } from '@/lib/assessment-api';
import { attendanceService } from '@/lib/engagement-api';
import { ApiError } from '@/lib/auth-api';
import { getVietnameseSubjectName } from '@/lib/subject-localization';
import type { TeacherAssignedClass } from '@/types/assessment';
import type { AttendanceAudit, AttendanceSession, AttendanceSessionDetail, AttendanceStatus } from '@/types/engagement';

const statuses: AttendanceStatus[] = ['NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'LEAVE'];
const labels: Record<AttendanceStatus, string> = {
  NOT_MARKED: 'Chưa điểm danh', PRESENT: 'Có mặt', ABSENT: 'Vắng',
  LATE: 'Đi trễ', EXCUSED: 'Được miễn', LEAVE: 'Nghỉ có phép',
};
const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
function todayInSchoolZone() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const sessionLabel = (session: AttendanceSession) => [session.startTime &&
  `${session.startTime}${session.endTime ? `–${session.endTime}` : ''}`, session.period, session.label]
  .filter(Boolean).join(' · ') || 'Lần mặc định';

export function TeacherAttendancePanel() {
  const [classes, setClasses] = useState<TeacherAssignedClass[]>([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(todayInSchoolZone);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<AttendanceSessionDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [period, setPeriod] = useState('');
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [audit, setAudit] = useState<AttendanceAudit[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const detailRequest = useRef(0);
  const selectedClass = classes.find((row) => row.id === classId);

  useEffect(() => {
    void academicDataService.getTeacherAssignedClasses().then((rows) => {
      setClasses(rows); setClassId(rows[0]?.id ?? ''); setSubjectId(rows[0]?.subjects[0]?.id ?? '');
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể tải lớp'))
      .finally(() => setLoading(false));
  }, []);

  const loadSessions = useCallback(async () => {
    if (!classId || !subjectId || !date) { setSessions([]); return; }
    setLoading(true);
    try { setSessions(await attendanceService.listSessions(classId, subjectId, date)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải các lần điểm danh'); }
    finally { setLoading(false); }
  }, [classId, subjectId, date]);

  useEffect(() => { detailRequest.current++; setSelectedId(''); setDetail(null); setStale(false); void loadSessions(); }, [loadSessions]);
  const loadDetail = useCallback(async (id: string) => {
    const request = ++detailRequest.current;
    const value = await attendanceService.getSession(id);
    const history = await attendanceService.getAudit(id);
    if (request !== detailRequest.current) return;
    setDetail(value);
    setDraft(Object.fromEntries(value.students.map((student) => [student.id, {
      status: student.status, note: student.attendance?.note ?? '',
    }])));
    setAudit(history);
    setStale(false);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    setDetail(null); setStale(false);
    void loadDetail(selectedId).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể tải buổi điểm danh'));
  }, [selectedId, loadDetail]);

  async function action(work: () => Promise<unknown>, refresh = true) {
    setBusy(true); setError('');
    try {
      await work();
      if (refresh) { await loadSessions(); if (selectedId) await loadDetail(selectedId); }
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && [409, 403].includes(cause.status)) setStale(true);
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật điểm danh'); return false;
    }
    finally { setBusy(false); }
  }
  async function create() {
    if (!classId || !subjectId || !date) return;
    let created: AttendanceSession | null = null;
    const okay = await action(async () => {
      created = await attendanceService.createSession(classId, { subjectId, date,
        ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}),
        ...(period.trim() ? { period: period.trim() } : {}),
        ...(label.trim() ? { label: label.trim() } : {}), status: 'OPEN' });
    }, false);
    if (okay && created) {
      await loadSessions(); setSelectedId((created as AttendanceSession).id);
      setStartTime(''); setEndTime(''); setPeriod(''); setLabel('');
    }
  }
  const summary = useMemo(() => Object.fromEntries(statuses.map((status) => [status,
    detail?.students.filter((student) => draft[student.id]?.status === status).length ?? 0])) as Record<AttendanceStatus, number>, [detail, draft]);
  const editable = detail?.session.status === 'OPEN' && !stale;
  const version = detail ? { expectedUpdatedAt: detail.session.updatedAt,
    expectedReopenedCount: detail.session.reopenedCount } : null;
  const marks = detail?.students.map((student) => ({ studentId: student.id, ...draft[student.id] })) ?? [];
  const dirty = detail?.students.some((student) => draft[student.id]?.status !== student.status ||
    draft[student.id]?.note !== (student.attendance?.note ?? '')) ?? false;
  async function finalize() {
    if (!detail || !version || stale) return;
    await action(async () => {
      // Include unsaved edits, then use only the version returned by this save.
      const saved = dirty ? await attendanceService.saveSession(detail.session.id, marks, version, reason) : null;
      await attendanceService.finalizeSession(detail.session.id, saved ? {
        expectedUpdatedAt: saved.updatedAt, expectedReopenedCount: saved.reopenedCount,
      } : version);
    });
  }

  return <AssessmentShell>
    <PageHeading eyebrow="Attendance" title="Điểm danh theo buổi" description="Chọn lớp, môn và ngày; mỗi lần điểm danh có danh sách học sinh cố định. Chỉ buổi đã chốt mới hiển thị cho học sinh." />
    {error ? <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {stale && selectedId ? <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      Dữ liệu đã thay đổi hoặc học kỳ không còn cho phép chỉnh sửa. Các lựa chọn chưa lưu vẫn giữ trên màn hình; không tự ghi đè.
      <Button variant="outline" disabled={busy} onClick={() => void action(() => loadDetail(selectedId), false)}>Tải lại dữ liệu (bỏ chỉnh sửa chưa lưu)</Button>
    </div> : null}
    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
      <label className="grid gap-1 text-sm">Lớp<select className={field} disabled={busy} value={classId} onChange={(event) => {
        const id = event.target.value; setClassId(id); setSubjectId(classes.find((row) => row.id === id)?.subjects[0]?.id ?? '');
      }}>{classes.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Môn<select className={field} disabled={busy} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>{selectedClass?.subjects.map((row) => <option key={row.id} value={row.id}>{getVietnameseSubjectName(row)}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Ngày học (giờ Việt Nam)<input className={field} type="date" disabled={busy} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </section>
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-bold">Các lần điểm danh trong ngày</h2>
      <div className="mt-3 flex flex-wrap gap-2">{sessions.map((session) => <button key={session.id} type="button" disabled={busy} onClick={() => setSelectedId(session.id)} className={`rounded-lg border px-3 py-2 text-sm ${selectedId === session.id ? 'border-brand-500 bg-blue-50' : 'border-slate-200'}`}>{sessionLabel(session)} · {session.status}</button>)}
        {!loading && !sessions.length ? <p className="text-sm text-slate-500">Chưa có lần điểm danh.</p> : null}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs">Bắt đầu (tùy chọn)<input className={field} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        <label className="grid gap-1 text-xs">Kết thúc (tùy chọn)<input className={field} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        <label className="grid gap-1 text-xs">Tiết/ca (tùy chọn)<input className={field} value={period} maxLength={60} onChange={(event) => setPeriod(event.target.value)} /></label>
        <label className="grid gap-1 text-xs">Nhãn (tùy chọn)<input className={field} value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} /></label>
      </div>
      <p className="mt-2 text-xs text-slate-500">Để trống mọi ô để dùng một lần điểm danh mặc định/ngày. Muốn thêm lần thứ hai, nhập giờ bắt đầu hoặc tiết/nhãn khác.</p>
      <Button className="mt-3" permission="attendance.update" disabled={busy || !classId || !subjectId || !date} onClick={() => void create()}>Tạo lần điểm danh</Button>
    </section>
    {detail ? <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{sessionLabel(detail.session)} · {detail.session.status}</h2><p className="text-xs text-slate-500">{detail.students.length} học sinh trong audience đã chốt · {date}</p></div>
        <div className="flex flex-wrap gap-2">{detail.session.status === 'DRAFT' ? <Button permission="attendance.update" disabled={busy || stale} onClick={() => void action(() => attendanceService.openSession(detail.session.id, version!))}>Mở buổi</Button> : null}
          {editable ? <><Button permission="attendance.update" variant="outline" disabled={busy} onClick={() => setDraft((current) => Object.fromEntries(Object.entries(current).map(([id, item]) => [id, { ...item, status: 'PRESENT' }])))}>Tất cả có mặt</Button>
            <Button permission="attendance.update" disabled={busy} onClick={() => void action(() => attendanceService.saveSession(detail.session.id, marks, version!, reason))}>Lưu</Button>
            <Button permission="attendance.update" disabled={busy || summary.NOT_MARKED > 0} onClick={() => void finalize()}>Chốt buổi</Button></> : null}
          {detail.session.status === 'FINALIZED' ? <Button permission="attendance.update" variant="outline" disabled={busy || stale || reason.trim().length < 3} onClick={() => void action(() => attendanceService.reopenSession(detail.session.id, reason, version!))}>Mở lại có lý do</Button> : null}</div></div>
      <p className="mt-3 text-sm">{statuses.map((status) => `${labels[status]}: ${summary[status]}`).join(' · ')}</p>
      {summary.NOT_MARKED > 0 && editable ? <p className="mt-2 text-xs text-amber-700">Còn {summary.NOT_MARKED} học sinh chưa điểm danh; backend sẽ từ chối chốt buổi.</p> : null}
      {detail.session.reopenedCount > 0 || detail.session.status === 'FINALIZED' ? <label className="mt-3 grid gap-1 text-sm">Lý do mở lại/chỉnh sau khi chốt<input className={field} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc khi sửa sau khi mở lại" /></label> : null}
      <div className="mt-4 space-y-2">{detail.students.map((student) => <div key={student.id} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] md:items-center">
        <p className="text-sm font-semibold">{student.fullName} <span className="font-normal text-slate-500">· {student.accountName}</span></p>
        <select aria-label={`Trạng thái ${student.fullName}`} className={field} disabled={!editable || busy} value={draft[student.id]?.status ?? 'NOT_MARKED'} onChange={(event) => setDraft((current) => ({ ...current, [student.id]: { ...current[student.id], status: event.target.value as AttendanceStatus } }))}>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select>
        <input aria-label={`Ghi chú ${student.fullName}`} className={field} disabled={!editable || busy} maxLength={500} placeholder="Ghi chú (tùy chọn)" value={draft[student.id]?.note ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [student.id]: { ...current[student.id], note: event.target.value } }))} />
      </div>)}</div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Lịch sử chỉnh sửa ({audit.length})</summary><ul className="mt-2 space-y-1">{audit.map((item) => <li key={item.id} className="rounded bg-slate-50 p-2">{new Date(item.createdAt).toLocaleString('vi-VN')} · {item.action} {item.studentId ? `· ${detail.students.find((student) => student.id === item.studentId)?.fullName ?? 'Học sinh'}` : ''} {item.oldStatus ? `${labels[item.oldStatus]} → ${item.newStatus ? labels[item.newStatus] : ''}` : ''} {item.reason ? `· ${item.reason}` : ''}</li>)}</ul></details>
    </section> : null}
  </AssessmentShell>;
}
