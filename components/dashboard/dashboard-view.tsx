"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronRight } from 'lucide-react';
import { StudentShell } from '@/components/student/student-shell';
import { Button } from '@/components/ui/button';
import { academicDataService } from '@/lib/assessment-api';
import { StudentCalendarPanel } from '@/components/student/student-calendar-panel';
import { getRecentStudentCourseAccesses } from '@/lib/student-recent-courses';
import { getVietnameseSubjectName } from '@/lib/subject-localization';
import type { StudentCourse } from '@/types/assessment';

function formatRecentAccess(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return 'Vừa truy cập';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} phút trước`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} giờ trước`;
  return new Date(value).toLocaleDateString('vi-VN');
}

export function StudentDashboardView() {
  const router = useRouter();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [recentAccesses, setRecentAccesses] = useState(() => getRecentStudentCourseAccesses());
  useEffect(() => {
    let active = true;
    setRecentAccesses(getRecentStudentCourseAccesses());
    void academicDataService.getStudentCourses().then((value) => {
      if (active) setCourses(value);
    }).catch(() => { if (active) setCourses([]); })
      .finally(() => { if (active) setCoursesLoading(false); });
    return () => { active = false; };
  }, []);
  const footerCourses = useMemo(() => {
    const recent = recentAccesses.flatMap((access) => {
      const course = courses.find((item) => item.classId === access.classId &&
        item.subjectId === access.subjectId);
      return course ? [{ course, visitedAt: access.visitedAt }] : [];
    });
    return recent.length ? recent.slice(0, 3) : [...courses]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3).map((course) => ({ course, visitedAt: null }));
  }, [courses, recentAccesses]);
  return <StudentShell><main className="space-y-5 p-4 sm:p-6">
    <StudentCalendarPanel showDetails={false} />
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><BookOpen className="size-5 text-brand-700" /><div><h2 className="font-extrabold">Lịch sử truy cập</h2><p className="text-xs text-slate-500">Tiếp tục nhanh từ những môn học bạn vừa xem.</p></div></div>
        <Button size="sm" variant="outline" onClick={() => router.push('/student/courses')}>Xem tất cả <ChevronRight className="size-4" /></Button></header>
      {coursesLoading ? <p className="p-6 text-sm text-slate-500">Đang tải môn học...</p> : null}
      {!coursesLoading && !footerCourses.length ? <p className="p-6 text-sm text-slate-500">Chưa có môn học để hiển thị.</p> : null}
      {!coursesLoading ? <div className="grid gap-3 p-4 md:grid-cols-3">{footerCourses.map(({ course, visitedAt }) => <button key={`${course.classId}:${course.subjectId}`} onClick={() => router.push(`/student/courses/${course.classId}/${course.subjectId}`)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:bg-blue-50/30">
        <span className="text-xs font-bold text-brand-700">{course.subject.code}</span><span className="mt-2 block font-extrabold">{getVietnameseSubjectName(course.subject)}</span>
        <span className="mt-1 block text-xs text-slate-500">{course.schoolClass.name} · {course.teacher.fullName}</span>
        <span className="mt-3 block text-xs text-slate-400">{visitedAt ? formatRecentAccess(visitedAt) : 'Môn học của bạn'}</span></button>)}</div> : null}
    </section>
  </main></StudentShell>;
}
