"use client";

import { StudentShell } from "@/components/student/student-shell";
import { StudentCalendarPanel } from "@/components/student/student-calendar-panel";

export function StudentCalendarPage() {
  return <StudentShell><main className="space-y-5 p-4 sm:p-6">
    <div><p className="text-sm font-semibold text-brand-700">Calendar</p><h1 className="text-2xl font-black">Lịch học tập</h1>
      <p className="mt-1 text-sm text-slate-500">Bài học, hạn bài tập, lịch kiểm tra và điểm danh của bạn.</p></div>
    <StudentCalendarPanel />
  </main></StudentShell>;
}
