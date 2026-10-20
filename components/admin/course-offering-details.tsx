"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { gradebookService } from "@/lib/gradebook-api";
import type { CourseMembers, CourseOffering } from "@/lib/course-offering-api";
import type { ClassRoster } from "@/types/assessment";
import type { GradebookView } from "@/types/gradebook";

export function CourseOfferingDetails({ course, members, roster, subjectName, className, yearName, termName, statusLabel }: {
  course: CourseOffering;
  members: CourseMembers;
  roster: ClassRoster | null;
  subjectName: string;
  className: string;
  yearName: string;
  termName: string;
  statusLabel: string;
}) {
  const [view, setView] = useState<GradebookView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setView(null); setError("");
    gradebookService.get({ classId: course.primaryClassId, subjectId: course.subjectId, termId: course.termId, courseOfferingId: course.id })
      .then((data) => { if (active) setView(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được sổ điểm"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [course.id, course.primaryClassId, course.subjectId, course.termId]);

  const teachers = members.teachers.filter((row) => !row.effectiveTo);
  const students = course.status === "DRAFT" && course.enrollmentMode === "CLASS_ROSTER"
    ? roster?.students.map((student) => ({ id: student.id, name: student.fullName, account: student.accountName })) ?? []
    : members.enrollments.filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.studentId, name: row.user?.fullName ?? row.studentId, account: row.user?.accountName }));
  const fields = [
    ["Tên hiển thị", course.displayName], ["Môn học", subjectName], ["Lớp", className],
    ["Năm học", yearName], ["Học kỳ", termName], ["Trạng thái", statusLabel],
  ];

  return <div className="space-y-5">
    <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl>
    <section aria-label="Giáo viên"><h3 className="font-bold text-slate-900">Giáo viên</h3>
      {teachers.length ? <ul className="mt-2 space-y-2 text-sm">{teachers.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3"><span>{row.user?.fullName ?? row.teacherId}</span><span className="text-slate-500">{row.role === "PRIMARY_TEACHER" ? "Giáo viên chính" : "Đồng giảng"}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Chưa phân công giáo viên.</p>}
    </section>
    <section className="border-t border-slate-100 pt-4" aria-label="Sổ điểm"><h3 className="font-bold text-slate-900">Sổ điểm</h3>
      {loading && <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải sổ điểm...</p>}
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      {!loading && !error && (view?.book ? <dl className="mt-3 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Loại sổ điểm</dt><dd className="mt-1 font-semibold">{view.book.resultMode === "INTERNAL" ? "Kết quả nội bộ theo hoạt động" : "Kết quả học kỳ (TX/GK/CK)"}</dd></div>
        <div><dt className="text-slate-500">Hình thức đánh giá</dt><dd className="mt-1 font-semibold">{view.book.assessmentMode === "NUMERIC" ? "Điểm số" : "Đạt / Chưa đạt"}</dd></div>
        {view.book.resultMode !== "INTERNAL" && <><div><dt className="text-slate-500">Số tiết môn học/năm</dt><dd className="mt-1 font-semibold">{view.book.annualPeriods}</dd></div><div><dt className="text-slate-500">Điểm cụm chuyên đề</dt><dd className="mt-1 font-semibold">{view.book.specialized ? "Có" : "Không"}</dd></div></>}
      </dl> : <p className="mt-2 text-sm text-slate-500">Chưa tạo sổ điểm.</p>)}
    </section>
    <section className="border-t border-slate-100 pt-4" aria-label="Học sinh"><h3 className="font-bold text-slate-900">Học sinh ({students.length})</h3>
      {course.status === "DRAFT" && course.enrollmentMode === "CLASS_ROSTER" && <p className="mt-1 text-xs text-slate-500">Danh sách học sinh hiện tại của lớp, sẽ được ghi danh khi bắt đầu giảng dạy.</p>}
      {students.length ? <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">{students.map((student) => <li key={student.id} className="rounded-lg border border-slate-100 p-2">{student.name}<span className="ml-2 text-xs text-slate-500">{student.account}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Chưa có học sinh.</p>}
    </section>
  </div>;
}
