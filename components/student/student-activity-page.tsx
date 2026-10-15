"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarCheck2, Check, CircleAlert, LoaderCircle } from "lucide-react";
import { AssessmentShell, ErrorPanel, PageHeading } from "@/components/assessment/assessment-shell";
import { attendanceService, NOTIFICATIONS_CHANGED_EVENT, notificationService } from "@/lib/engagement-api";
import type { AttendanceHistoryRecord as AttendanceRecord, PortalNotification } from "@/types/engagement";

const attendanceLabels: Record<AttendanceRecord['status'], string> = {
  NOT_MARKED: 'Chưa điểm danh', UNDER_REVIEW: 'Đang rà soát', PRESENT: 'Có mặt', ABSENT: 'Vắng',
  LATE: 'Đi trễ', EXCUSED: 'Được miễn', LEAVE: 'Nghỉ có phép',
};

export function StudentActivityPage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [termFilter, setTermFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');

  useEffect(() => {
    void Promise.all([attendanceService.getMine({ limit: 100 }), notificationService.getMine()])
      .then(([attendanceItems, notificationItems]) => {
        setAttendance(attendanceItems);
        setNotifications(notificationItems);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Không thể tải hoạt động của bạn"))
      .finally(() => setLoading(false));
  }, []);

  const terms = useMemo(() => [...new Map(attendance.map((item) => [item.termId ?? 'LEGACY',
    item.term?.name ?? 'Lịch sử cũ']))], [attendance]);
  const subjects = useMemo(() => [...new Map(attendance.map((item) => [item.subjectId,
    item.subject?.name ?? 'Môn học']))], [attendance]);
  const filteredAttendance = attendance.filter((item) =>
    (termFilter === 'ALL' || (item.termId ?? 'LEGACY') === termFilter) &&
    (subjectFilter === 'ALL' || item.subjectId === subjectFilter));

  async function markRead(item: PortalNotification) {
    if (item.readAt) return;
    await notificationService.markRead(item.id);
    setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }

  async function openNotification(item: PortalNotification) {
    const href = notificationHref(item);
    try {
      await markRead(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật thông báo");
    }
    if (href) router.push(href);
  }

  return <AssessmentShell student>
    <PageHeading eyebrow="Activity" title="Điểm danh & thông báo" description="Theo dõi lịch sử học tập và thông tin mới nhất từ nhà trường." />
    {loading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-8 animate-spin text-brand-600" /></div> : null}
    {error ? <ErrorPanel message={error} /> : null}
    {!loading && !error ? <div className="grid gap-6 xl:grid-cols-2">
      <div><div className="mb-3 flex flex-wrap gap-2 text-sm"><select aria-label="Lọc học kỳ" className="rounded-lg border border-slate-200 p-2" value={termFilter} onChange={(event) => setTermFilter(event.target.value)}><option value="ALL">Mọi học kỳ</option>{terms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Lọc môn học" className="rounded-lg border border-slate-200 p-2" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="ALL">Mọi môn</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <TimelineSection icon={CalendarCheck2} title="Lịch sử điểm danh" empty="Chưa có buổi điểm danh đã chốt phù hợp.">
          {filteredAttendance.map((item) => <TimelineItem key={item.id} tone={item.status === 'PRESENT' || item.status === 'LATE' ? 'emerald' : item.status === 'NOT_MARKED' ? 'slate' : 'rose'} icon={item.status === 'PRESENT' || item.status === 'LATE' ? Check : CircleAlert} title={attendanceLabels[item.status]} time={new Date(item.sessionDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' })}><p>{item.subject?.name ?? 'Môn học'} · {item.class?.name ?? 'Lớp học'}{item.startTime ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ''}` : item.period ? ` · ${item.period}` : ''}</p>{item.note ? <p className="mt-1 text-xs">Ghi chú: {item.note}</p> : null}{item.legacy ? <p className="mt-1 text-xs">Dữ liệu điểm danh cũ (không rõ giờ)</p> : null}</TimelineItem>)}
        </TimelineSection></div>
      <TimelineSection icon={BellRing} title="Thông báo" empty="Bạn chưa có thông báo mới.">
        {notifications.map((item) => {
          const href = notificationHref(item);
          return <TimelineItem key={item.id} tone={item.readAt ? "slate" : "brand"} icon={BellRing} title={item.title} time={new Date(item.createdAt).toLocaleString("vi-VN")} onActivate={() => void openNotification(item)}><p className="whitespace-pre-wrap">{item.message}</p><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold">Từ {item.senderName}</span><span className={`text-xs font-bold ${href ? "text-brand-700" : item.readAt ? "text-emerald-600" : "text-slate-500"}`}>{href ? "Xem bài kiểm tra →" : item.readAt ? "Đã đọc" : "Mở để đánh dấu đã đọc"}</span></div></TimelineItem>;
        })}
      </TimelineSection>
    </div> : null}
  </AssessmentShell>;
}

function TimelineSection({ icon: Icon, title, empty, children }: { icon: typeof BellRing; title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand-700"><Icon className="size-5" /></span><h2 className="text-lg font-extrabold">{title}</h2></div><div className="mt-6">{items.length && items.some(Boolean) ? children : <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{empty}</p>}</div></section>;
}

function TimelineItem({ icon: Icon, tone, title, time, children, onActivate }: { icon: typeof BellRing; tone: "emerald" | "rose" | "brand" | "slate"; title: string; time: string; children: React.ReactNode; onActivate?: () => void }) {
  const colors = { emerald: "bg-emerald-100 text-emerald-700", rose: "bg-rose-100 text-rose-700", brand: "bg-blue-100 text-brand-700", slate: "bg-slate-100 text-slate-500" }[tone];
  return <article onClick={onActivate} onKeyDown={(event) => { if (onActivate && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onActivate(); } }} role={onActivate ? "link" : undefined} tabIndex={onActivate ? 0 : undefined} className={`relative grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-xl pb-6 outline-none last:pb-0 ${onActivate ? "cursor-pointer focus-visible:ring-4 focus-visible:ring-blue-100" : ""}`}><span className="absolute bottom-0 left-[21px] top-11 border-l border-dashed border-slate-300 last:hidden" /><span className={`z-10 grid size-11 place-items-center rounded-full ${colors}`}><Icon className="size-5" /></span><div className="min-w-0 rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-extrabold">{title}</h3><time className="text-xs text-slate-400">{time}</time></div><div className="mt-2 text-sm leading-6 text-slate-600">{children}</div></div></article>;
}

function notificationHref(item: PortalNotification): string | null {
  if (item.actionUrl?.startsWith("/student/")) return item.actionUrl;
  return item.examId ? `/student/exams/${encodeURIComponent(item.examId)}` : null;
}
