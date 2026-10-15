"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { academicDataService } from "@/lib/assessment-api";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import { courseOfferingApi, type CourseEnrollmentMode, type CourseMembers, type CourseOffering, type CourseTeacherRole } from "@/lib/course-offering-api";
import type { AcademicYear, ClassRoster, SchoolClass, Subject, Term } from "@/types/assessment";
import type { UsersPage } from "@/types/users";
import type { User } from "@/types/auth";

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500";
const labelClass = "grid gap-1.5 text-sm font-semibold text-slate-700";
const errorText = (error: unknown) => error instanceof ApiError ? error.message : "Thao tác không thành công";

export function CourseOfferingPanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [readiness, setReadiness] = useState({ dbPrepared: false, cutoverReady: false });
  const [members, setMembers] = useState<CourseMembers | null>(null);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [yearId, setYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionKey, setSectionKey] = useState("MAIN");
  const [enrollmentMode, setEnrollmentMode] = useState<CourseEnrollmentMode>("CLASS_ROSTER");
  const [selectedId, setSelectedId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherRole, setTeacherRole] = useState<CourseTeacherRole>("PRIMARY_TEACHER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = courses.find((course) => course.id === selectedId);
  const yearTerms = useMemo(() => terms.filter((term) => term.academicYearId === yearId && !term.deletedAt), [terms, yearId]);
  const yearClasses = useMemo(() => classes.filter((schoolClass) => schoolClass.academicYearId === yearId && schoolClass.isActive && !schoolClass.deletedAt), [classes, yearId]);
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.isActive && !subject.deletedAt), [subjects]);

  const refresh = useCallback(async () => {
    const rows = await courseOfferingApi.list();
    setCourses(rows);
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      academicDataService.getAcademicYears(true),
      academicDataService.getTerms(undefined, true),
      academicDataService.getClasses(undefined, true),
      academicDataService.getSubjects(true),
      authenticatedRequest<UsersPage>("/users?role=TEACHER&status=ACTIVE&limit=100"),
      courseOfferingApi.readiness(),
    ]).then(([yearRows, termRows, classRows, subjectRows, teacherPage, courseReadiness]) => {
      if (!active) return;
      setYears(yearRows); setTerms(termRows); setClasses(classRows); setSubjects(subjectRows);
      setTeachers(teacherPage.items);
      setReadiness(courseReadiness);
      setYearId(yearRows.find((year) => year.status !== "COMPLETED")?.id ?? yearRows[0]?.id ?? "");
    }).catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    void refresh().catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!yearTerms.some((term) => term.id === termId)) setTermId(yearTerms[0]?.id ?? "");
    if (!yearClasses.some((schoolClass) => schoolClass.id === classId)) setClassId(yearClasses[0]?.id ?? "");
  }, [yearTerms, yearClasses, termId, classId]);

  useEffect(() => {
    if (!activeSubjects.some((subject) => subject.id === subjectId)) setSubjectId(activeSubjects[0]?.id ?? "");
  }, [activeSubjects, subjectId]);

  useEffect(() => {
    if (!selected) { setMembers(null); setRoster(null); return; }
    let active = true;
    Promise.all([courseOfferingApi.members(selected.id), academicDataService.getClassRoster(selected.primaryClassId)])
      .then(([memberRows, classRoster]) => { if (active) { setMembers(memberRows); setRoster(classRoster); } })
      .catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [selected]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await action();
      await refresh();
      if (selectedId) setMembers(await courseOfferingApi.members(selectedId));
      setMessage(success);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  const activeTeachers = members?.teachers.filter((teacher) => !teacher.effectiveTo) ?? [];
  const activeEnrollmentIds = new Set(members?.enrollments.filter((row) => row.status === "ACTIVE").map((row) => row.studentId) ?? []);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-900">Lớp môn học theo học kỳ</h2>
      <p className="mt-1 text-sm text-slate-600">Subject là danh mục; CourseOffering mới là môn dạy cho một lớp hoặc nhóm trong một học kỳ. Dữ liệu cũ chưa được tự gán Course.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {!readiness.dbPrepared && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Chế độ xem trước: database chưa được chuẩn bị cho CourseOffering. Mọi thao tác ghi đang bị khóa; dữ liệu lớp môn học cũ chưa được chuyển đổi.</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className={labelClass}>Năm học<select className={inputClass} value={yearId} onChange={(event) => setYearId(event.target.value)}>
          {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
        </select></label>
        <label className={labelClass}>Học kỳ<select className={inputClass} value={termId} onChange={(event) => setTermId(event.target.value)}>
          {yearTerms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.status}</option>)}
        </select></label>
        <label className={labelClass}>Lớp<select className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)}>
          {yearClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select></label>
        <label className={labelClass}>Môn danh mục<select className={inputClass} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          {activeSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.vietnameseName || subject.name}</option>)}
        </select></label>
        <label className={labelClass}>Chế độ ghi danh<select className={inputClass} value={enrollmentMode} onChange={(event) => setEnrollmentMode(event.target.value as CourseEnrollmentMode)}>
          <option value="CLASS_ROSTER">Cả lớp (CLASS_ROSTER)</option><option value="MANUAL">Chọn học sinh trong lớp (MANUAL)</option>
        </select></label>
        <label className={labelClass}>Mã nhóm<input className={inputClass} value={sectionKey} maxLength={24} onChange={(event) => setSectionKey(event.target.value.toUpperCase())} /></label>
      </div>
      <Button className="mt-4" disabled={busy || !readiness.dbPrepared || !termId || !classId || !subjectId || !/^[A-Z0-9_-]{1,24}$/.test(sectionKey)}
        onClick={() => void act(() => courseOfferingApi.create({ termId, primaryClassId: classId, subjectId, enrollmentMode, sectionKey }), "Đã tạo Course DRAFT")}>Tạo lớp môn học</Button>
    </section>

    <section className="grid gap-5 lg:grid-cols-[minmax(250px,1fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-extrabold">Course Offerings ({courses.length})</h3>
        <div className="mt-3 space-y-2">{courses.map((course) => <button type="button" key={course.id} onClick={() => setSelectedId(course.id)}
          className={`w-full rounded-xl border p-3 text-left text-sm ${selectedId === course.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
          <span className="block font-bold">{course.displayName}</span>
          <span className="text-slate-600">{course.sectionKey} · {course.status} · {course.activeStudentCount} học sinh</span>
        </button>)}{!courses.length && <p className="text-sm text-slate-500">Chưa có CourseOffering. Danh mục Subject không tự tạo Course.</p>}</div>
      </div>

      {selected && <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h3 className="font-extrabold">{selected.displayName}</h3><p className="text-sm text-slate-600">{selected.status} · {selected.enrollmentMode} · {selected.sectionKey}</p></div>
        <div className="flex flex-wrap gap-2">
          {selected.status === "DRAFT" && <Button disabled={busy || !readiness.dbPrepared || !selected.readyForOpen || selected.term?.status !== "ACTIVE" || !activeTeachers.some((row) => row.role === "PRIMARY_TEACHER")}
            onClick={() => void act(() => courseOfferingApi.transition(selected.id, "open"), "Đã mở Course")}>Mở Course</Button>}
          {selected.status === "OPEN" && <Button disabled={busy || !readiness.dbPrepared} onClick={() => void act(() => courseOfferingApi.transition(selected.id, "close"), "Đã đóng Course")}>Đóng Course</Button>}
          {selected.status === "CLOSED" && <Button disabled={busy || !readiness.dbPrepared} onClick={() => void act(() => courseOfferingApi.transition(selected.id, "archive"), "Đã lưu trữ Course")}>Lưu trữ</Button>}
        </div>
        {selected.status === "DRAFT" && selected.term?.status !== "ACTIVE" && <p className="text-xs text-amber-700">Chỉ mở Course khi học kỳ ACTIVE.</p>}
        {selected.status === "DRAFT" && !selected.readyForOpen && <p className="text-xs text-amber-700">Chưa thể mở: Content, Assignment, Exam, Gradebook, Progress và Attendance chưa chuyển sang Course ID.</p>}
        <div className="border-t border-slate-100 pt-4">
          <h4 className="font-bold">Giáo viên</h4>
          <ul className="mt-2 space-y-1 text-sm">{activeTeachers.map((row) => <li key={row.id} className="flex items-center justify-between gap-2">
            <span>{row.user?.fullName || row.teacherId} · {row.role === "PRIMARY_TEACHER" ? "Giáo viên chính" : "Đồng giảng"}</span>
            {(row.role !== "PRIMARY_TEACHER" || selected.status !== "OPEN") && <button className="text-rose-700" disabled={busy || !readiness.dbPrepared}
              onClick={() => void act(() => courseOfferingApi.endTeacher(selected.id, row.teacherId), "Đã kết thúc phân công")}>Kết thúc</button>}
          </li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Chọn giáo viên" className={`${inputClass} max-w-56`} value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Chọn giáo viên</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select><select aria-label="Vai trò giáo viên" className={`${inputClass} max-w-48`} value={teacherRole} onChange={(event) => setTeacherRole(event.target.value as CourseTeacherRole)}>
            <option value="PRIMARY_TEACHER">Giáo viên chính</option><option value="CO_TEACHER">Đồng giảng</option>
          </select><Button disabled={busy || !readiness.dbPrepared || !teacherId || selected.status === "ARCHIVED"} onClick={() => void act(() =>
            teacherRole === "PRIMARY_TEACHER" && activeTeachers.some((row) => row.role === "PRIMARY_TEACHER")
              ? courseOfferingApi.replacePrimary(selected.id, teacherId)
              : courseOfferingApi.assignTeacher(selected.id, teacherId, teacherRole), "Đã cập nhật giáo viên")}>Phân công</Button></div>
        </div>
        <div className="border-t border-slate-100 pt-4"><h4 className="font-bold">Học sinh ({selected.activeStudentCount})</h4>
          {selected.enrollmentMode === "CLASS_ROSTER" ? <p className="mt-1 text-sm text-slate-600">Snapshot khi mở Course; học sinh vào/rời lớp sau đó được đồng bộ từ nghiệp vụ lớp.</p>
            : <div className="mt-2 max-h-64 space-y-2 overflow-auto">{roster?.students.map((student) => <div key={student.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                <span>{student.fullName}</span>{activeEnrollmentIds.has(student.id) ? <button className="text-rose-700" disabled={busy || !readiness.dbPrepared}
                  onClick={() => void act(() => courseOfferingApi.withdraw(selected.id, student.id), "Đã rút học sinh khỏi Course")}>Rút</button>
                  : <button className="text-blue-700" disabled={busy || !readiness.dbPrepared || selected.status === "CLOSED" || selected.status === "ARCHIVED"}
                    onClick={() => void act(() => courseOfferingApi.enroll(selected.id, student.id), "Đã ghi danh học sinh")}>Ghi danh</button>}</div>)}</div>}
        </div>
      </div>}
    </section>
  </div>;
}
