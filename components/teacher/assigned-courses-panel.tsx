"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, ChevronRight, LoaderCircle } from "lucide-react";
import { academicDataService } from "@/lib/assessment-api";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type { TeacherAssignedClass } from "@/types/assessment";

export function TeacherAssignedCoursesPanel({ preview = false }: { preview?: boolean }) {
  const [classes, setClasses] = useState<TeacherAssignedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void academicDataService.getTeacherAssignedClasses()
      .then((rows) => { if (active) setClasses(rows); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải môn học được phân công");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const courses = useMemo(() => classes.flatMap((schoolClass) =>
    schoolClass.subjects.map((subject) => ({ schoolClass, subject }))), [classes]);

  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-extrabold">Môn học được phân công</h2>
        <p className="mt-1 text-xs text-slate-500">Mở môn học để quản lý chủ đề, bài học, tài nguyên và bài tập trong lớp.</p></div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">{courses.length} môn học</span>
        {preview ? <Link href="/teacher/courses" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">Xem chi tiết<ChevronRight className="size-4" /></Link> : null}
      </div>
    </div>
    {loading ? <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải phân công...</p> : null}
    {error ? <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {!loading && !error && !courses.length ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Bạn chưa được phân công môn học tại lớp nào. Liên hệ Admin để tạo phân công giáo viên môn học.</p> : null}
    {!loading && !error ? <div className={preview ? "mt-4 overflow-x-auto overscroll-x-contain pb-2" : "mt-4"} tabIndex={preview ? 0 : undefined} role={preview ? "region" : undefined} aria-label={preview ? "Danh sách môn học, cuộn ngang để xem thêm" : undefined}>
      <div className={preview ? "grid min-w-[960px] grid-flow-col gap-3" : "grid gap-3 lg:grid-cols-3"} style={preview ? { gridAutoColumns: "calc((100% - 2.25rem) / 4)" } : undefined}>
      {courses.map(({ schoolClass, subject }) => <Link key={`${schoolClass.id}:${subject.id}`}
        href={`/teacher/classes/${schoolClass.id}?subjectId=${subject.id}`}
        className="group min-w-0 rounded-2xl border border-slate-100 p-4 transition hover:border-brand-300 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <div className="flex items-start justify-between gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><BookOpenCheck className="size-5" /></span>
          <ChevronRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></div>
        <h3 className="mt-3 text-sm font-extrabold text-slate-900">{getVietnameseSubjectName(subject)}</h3>
        <p className="mt-1 text-xs font-semibold text-brand-600">{schoolClass.code} · {subject.code}</p>
        <p className="mt-2 text-xs text-slate-500">{schoolClass.name} · {schoolClass.studentCount} học sinh</p>
        <p className="mt-3 text-xs font-bold text-brand-700">Quản lý môn học →</p>
      </Link>)}
      </div>
    </div> : null}
  </section>;
}
