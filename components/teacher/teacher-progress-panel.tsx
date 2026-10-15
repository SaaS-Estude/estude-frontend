"use client";

import { useCallback, useEffect, useState } from "react";
import { progressService } from "@/lib/progress-api";
import type { TeacherCourseProgress } from "@/types/progress";

export function TeacherProgressPanel({ classId, subjectId }: { classId: string; subjectId: string }) {
  const [data, setData] = useState<TeacherCourseProgress | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      setData(await progressService.teacherCourse(classId, subjectId));
      setError("");
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Không thể tải tiến độ lớp");
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId]);

  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="font-bold">Tiến độ học sinh</h3><p className="text-xs text-slate-500">Theo bài học bắt buộc đã công bố trong lớp và môn hiện tại.</p></div>
      <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" disabled={loading} onClick={() => void load()}>{loading ? "Đang tải..." : "Làm mới"}</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    {data && !data.students.length ? <p className="mt-3 text-sm text-slate-500">Chưa có học sinh đang theo học.</p> : null}
    {data?.students.map((student) => <details key={student.studentId} className="mt-3 rounded-lg border border-slate-100 p-3">
      <summary className="cursor-pointer text-sm font-semibold">{student.fullName} · {student.percent}% · {student.completedLessons}/{student.requiredLessons} bài hoàn thành <span className="font-normal text-slate-500">(đang học {student.inProgressLessons}, chưa bắt đầu {student.notStartedLessons})</span></summary>
      <div className="mt-3 space-y-3">{student.topics.map((topic) => <div key={topic.id} className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-semibold">{topic.name}: {topic.completedLessons}/{topic.requiredLessons} bài · {topic.percent}%</p>
        <ul className="mt-2 space-y-1">{topic.lessons.map((lesson) => <li key={lesson.id}>
          <span>{lesson.title}: {lesson.status === "COMPLETED" ? "Hoàn thành" : lesson.status === "IN_PROGRESS" ? "Đang học" : "Chưa bắt đầu"}{lesson.required ? "" : " (tự chọn)"}</span>
          {lesson.activities.length ? <ul className="ml-4 text-xs text-slate-600">{lesson.activities.map((activity) => <li key={`${activity.type}-${activity.id}`}>{activity.title}: {activity.status === "COMPLETED" || activity.status === "EXCUSED" ? "Hoàn thành" : activity.status === "IN_PROGRESS" ? "Đang thực hiện" : "Chưa bắt đầu"}{activity.required ? "" : " (tự chọn)"}</li>)}</ul> : null}
        </li>)}</ul>
      </div>)}</div>
    </details>)}
  </section>;
}
