"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { CustomSelect } from "@/components/ui/form-control";
import { calendarService } from "@/lib/calendar-api";
import { calendarDay, calendarEventTime, calendarMonth, calendarTime, calendarZone } from "@/lib/calendar-view";
import type { CalendarResponse } from "@/types/calendar";

const labels: Record<string, string> = {
  UPCOMING: "Sắp mở", OPEN: "Đang mở", OVERDUE: "Quá hạn · còn nhận nộp",
  CLOSED: "Đã khóa", SUBMITTED: "Đã nộp", EXCUSED: "Được miễn",
  IN_PROGRESS: "Đang làm", FINALIZED: "Đã hoàn tất", ENDED: "Đã kết thúc",
};

export function StudentCalendarPanel({ showDetails = true }: { showDetails?: boolean }) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(() => calendarDay(new Date(), calendarZone));
  const month = selectedDay.slice(0, 7);
  const { from, to } = calendarMonth(month);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [retry, setRetry] = useState(0);
  const zone = data?.timeZone ?? calendarZone;
  const today = calendarDay(new Date(), zone);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null);
    void calendarService.month(from, to).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch học tập");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, retry]);
  const subjects = useMemo(() => [...new Map((data?.events ?? []).map((event) => [event.subject.id, event.subject.name])).entries()], [data]);
  const events = (data?.events ?? []).filter((event) => !subjectId || event.subject.id === subjectId);
  const daily = events.filter((event) => calendarEventTime(event, selectedDay, zone) !== null);
  function changeMonth(next: string) { setSelectedDay(`${next}-01`); setSubjectId(""); }

  return <div className="space-y-4">
    <MonthCalendar month={month} today={today} selectedDay={selectedDay} onSelectDay={setSelectedDay} onChangeMonth={changeMonth}
      toolbar={<><CustomSelect
        ariaLabel="Lọc môn học"
        value={subjectId}
        onValueChange={setSubjectId}
        className="w-full sm:w-72"
        searchable
        searchPlaceholder="Tìm môn học..."
        options={[
          { value: "", label: "Tất cả môn học" },
          ...subjects.map(([id, name]) => ({ value: id, label: name })),
        ]}
      />
        {!showDetails ? <button onClick={() => router.push('/student/calendar')} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-brand-700">Mở lịch học tập</button> : null}</>}
      renderDay={(day) => events.filter((event) => calendarEventTime(event, day, zone) !== null).map((event) => <button key={`${event.type}:${event.sourceId}`} onClick={() => router.push(event.sourceUrl)} className={`block w-full rounded-lg border p-2 text-left ${event.type === 'EXAM' ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <span className="block text-xs font-bold">{event.title}</span><span className="mt-1 block text-[11px] opacity-80">{event.subject.name} · {event.schoolClass.code}</span>
        <span className="mt-1 block text-[10px]">{event.type === 'EXAM' ? 'Bài kiểm tra' : 'Hạn bài tập'} · {calendarTime(event.startAt, zone)}</span>
        <span className="mt-1 block text-[10px] font-semibold">{labels[event.status] ?? event.status}</span>
      </button>)} />
    {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải lịch...</p> : null}
    {error ? <div role="alert" className="text-sm text-rose-700">{error}<button onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">Thử lại</button></div> : null}
    {!loading && !error && !events.length ? <p className="text-sm text-slate-500">Tháng này không có hạn bài tập hoặc bài kiểm tra{subjectId ? ' cho môn học đã chọn' : ''}.</p> : null}
    {showDetails ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="font-extrabold">{selectedDay.split('-').reverse().join('/')}</h2>
      {!loading && !error && !daily.length ? <p className="mt-3 text-sm text-slate-500">Ngày này không có hạn bài tập hoặc bài kiểm tra.</p> : null}
      {daily.map((event) => <button key={`${event.type}:${event.sourceId}`} onClick={() => router.push(event.sourceUrl)} className="mt-3 block w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-blue-50/30">
        <span className="block text-xs text-slate-500">{event.subject.name} · {event.schoolClass.code}</span>
        <span className="mt-1 block font-bold">{event.title}</span>
        <span className="mt-1 block text-xs text-slate-600">{new Date(event.startAt).toLocaleString('vi-VN', { timeZone: zone })}{event.type === 'EXAM' && event.endAt ? ` – ${new Date(event.endAt).toLocaleString('vi-VN', { timeZone: zone })}` : ''} · {labels[event.status] ?? event.status}</span>
        {event.hasPersonalSchedule ? <span className="mt-1 block text-xs text-brand-700">Lịch riêng giáo viên đã cấp cho bạn</span> : null}
        {event.historyOnly ? <span className="mt-1 block text-xs text-amber-700">Chỉ xem lịch sử{event.canResume ? ' hoặc tiếp tục lượt đang làm' : ''}; không mở lượt mới.</span> : null}
        <span className="mt-1 block text-xs text-slate-500">{event.canResume ? 'Tiếp tục bài đang làm' : event.canStart ? 'Có thể mở lượt làm bài mới' : event.canSubmit ? 'Còn nhận bài nộp' : 'Xem chi tiết và lịch sử'}</span>
        {event.status === 'UPCOMING' && event.availableFrom ? <span className="mt-1 block text-xs text-amber-700">Mở từ {new Date(event.availableFrom).toLocaleString('vi-VN', { timeZone: zone })}</span> : null}
      </button>)}
    </section> : null}
  </div>;
}
