"use client";

import { Button } from '@/components/ui/button';
import type { StudentCourseProgress } from '@/types/progress';

export function CourseProgressSummary({ progress, error, onRefresh }: {
  progress: StudentCourseProgress | null; error?: string; onRefresh: () => void;
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card" aria-label="Tiến độ môn học">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-black text-slate-950">Tiến độ hoàn thành</h2>
        <p className="text-xs text-slate-500">Dựa trên hoạt động bắt buộc, không phải điểm số hay mức độ hiểu bài.</p></div>
      <Button variant="outline" size="sm" onClick={onRefresh}>Làm mới tiến độ</Button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    {progress ? <>
      <div className="mt-4 flex items-end gap-3"><span className="text-3xl font-black text-brand-700">{progress.percent}%</span>
        <span className="pb-1 text-sm text-slate-600">{progress.completedLessons}/{progress.requiredLessons} bài học bắt buộc</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{progress.topics.map((topic) =>
        <div key={topic.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p className="font-bold text-slate-800">{topic.name}</p>
          <p className="text-xs text-slate-600">{topic.completedLessons}/{topic.requiredLessons} bài bắt buộc · {topic.percent}%</p>
        </div>)}</div>
    </> : <p className="mt-3 text-sm text-slate-500">Đang tải tiến độ...</p>}
  </section>;
}
