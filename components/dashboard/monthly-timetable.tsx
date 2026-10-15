"use client";

import { useState } from "react";
import { MapPin, Video } from "lucide-react";
import { TeacherAssignedCoursesPanel } from "@/components/teacher/assigned-courses-panel";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { CustomSelect } from "@/components/ui/form-control";
import { calendarDay, calendarZone } from "@/lib/calendar-view";

type TimetableSession = {
  date: string;
  time: string;
  subject: string;
  room: string;
  mode: string;
  tone: string;
};

export function MonthlyTimetable({ sessions = [] }: { sessions?: readonly TimetableSession[] }) {
  const today = calendarDay(new Date(), calendarZone);
  const [selectedDay, setSelectedDay] = useState(today);
  const [subject, setSubject] = useState("");
  return <div className="space-y-5">
    <MonthCalendar month={selectedDay.slice(0, 7)} today={today} selectedDay={selectedDay} onSelectDay={setSelectedDay} onChangeMonth={(month) => setSelectedDay(`${month}-01`)}
      toolbar={<CustomSelect
        ariaLabel="Lọc môn học"
        value={subject}
        onValueChange={setSubject}
        className="w-full sm:w-72"
        searchable
        searchPlaceholder="Tìm môn học..."
        options={[
          { value: "", label: "Tất cả môn học" },
          ...[...new Set(sessions.map((session) => session.subject))].map((name) => ({ value: name, label: name })),
        ]}
      />}
      renderDay={(day) => sessions.filter((session) => session.date === day && (!subject || session.subject === subject)).sort((left, right) => left.time.localeCompare(right.time)).map((session, index) => <article key={`${session.time}:${session.subject}:${index}`} className={`rounded-lg border p-2 ${session.tone}`}>
        <p className="text-xs font-extrabold">{session.subject}</p>
        <p className="mt-1 text-[11px] font-semibold">{session.time}</p>
        <div className="mt-1 flex items-center gap-1 text-[11px] opacity-75">{session.mode === "Trực tuyến" ? <Video className="size-3" /> : <MapPin className="size-3" />}{session.room}</div>
        <p className="mt-1 text-[10px] opacity-75">{session.mode}</p>
      </article>)} />
    <TeacherAssignedCoursesPanel preview />
  </div>;
}
