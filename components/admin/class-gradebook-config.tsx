"use client";
import type { CourseOffering } from "@/lib/course-offering-api";
import { LegacyPurposeReview } from "./legacy-purpose-review";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { CustomSelect } from "@/components/ui/form-control";
import { defaultGradePolicy, GradebookPolicyFields } from "./gradebook-policy-fields";
import { academicDataService } from "@/lib/assessment-api";
import { gradebookService } from "@/lib/gradebook-api";
import type { SchoolClass, SubjectTeacherAssignment, Term } from "@/types/assessment";
import type { GradebookView, GradePolicy } from "@/types/gradebook";

import { Button } from "@/components/ui/button";



export function ClassGradebookConfig({ schoolClass, course }: { schoolClass: SchoolClass; course?:CourseOffering }) {
  const workspaceId=course?.id;
  const [assignments, setAssignments] = useState<SubjectTeacherAssignment[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [view, setView] = useState<GradebookView | null>(null);
  const [policy, setPolicy] = useState<GradePolicy>(defaultGradePolicy);
  const [loading, setLoading] = useState(true);
  const [bookLoading, setBookLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  const subjects = useMemo(() => course?.subject ? [course.subject] : [...new Map(assignments.filter((item) => item.isActive).map((item) => [item.subjectId, item.subject])).values()], [assignments,course]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      course ? Promise.resolve([]) : academicDataService.getSubjectTeacherAssignments({ classId: schoolClass.id }),
      academicDataService.getTerms(schoolClass.academicYearId, true),
    ]).then(([loadedAssignments, loadedTerms]) => {
      if (!active) return;
      setAssignments(loadedAssignments);
      setTerms(course ? loadedTerms.filter((term)=>term.id===course.termId) : loadedTerms);
      setSubjectId(course?.subjectId ?? loadedAssignments.find((item) => item.isActive)?.subjectId ?? "");
      setTermId(course?.termId ?? (loadedTerms.find((item) => item.status === "ACTIVE") ?? loadedTerms[0])?.id ?? "");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được môn học và học kỳ");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [schoolClass.id, schoolClass.academicYearId,course]);

  useEffect(() => {
    let active = true;
    setView(null);
    setPolicy(defaultGradePolicy);
    if (!subjectId || !termId) return;
    setBookLoading(true);
    setError("");
    gradebookService.get({ classId: schoolClass.id, subjectId, termId,...(workspaceId?{courseOfferingId:workspaceId}:{}) })
      .then((loaded) => {
        if (!active) return;
        setView(loaded);
        setPolicy(loaded.book ?? defaultGradePolicy);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được sổ điểm");
      })
      .finally(() => { if (active) setBookLoading(false); });
    return () => { active = false; };
  }, [schoolClass.id, subjectId, termId, refresh,workspaceId]);

  const hasMarks = !!view?.items?.length || (view?.students.some((student) => student.record) ?? false);
  const readOnly = !schoolClass.isActive || view?.year?.status === "COMPLETED" || (view ? ["COMPLETED", "LOCKED"].includes(view.term.status) : false);
  const canSave = Boolean(view && !loading && !bookLoading && !saving && !hasMarks && !readOnly &&
    Number.isInteger(policy.annualPeriods) && policy.annualPeriods >= 35 && policy.annualPeriods <= 1000);

  async function save() {
    if (!canSave || !view) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await gradebookService.configure({ classId: schoolClass.id, subjectId, termId,...(workspaceId?{courseOfferingId:workspaceId}:{}), ...policy, revision: view.book?.revision ?? 0 });
      setNotice("Đã lưu cấu hình sổ điểm.");
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được cấu hình sổ điểm");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-4">
    <div>
      <h3 className="font-bold text-slate-900">Cấu hình kết quả nội bộ</h3>
      <p className="mt-1 text-xs text-slate-500">Chọn môn học và học kỳ của {schoolClass.name}. Điểm từng hoạt động được lưu và công bố theo môn, học kỳ.</p>
    </div>
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}
    {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải môn học...</p> : <>
      {!subjects.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Lớp chưa được phân công giáo viên bộ môn. Hãy phân công môn học trước khi cấu hình sổ điểm.</p> : null}
      {!terms.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Năm học này chưa có học kỳ.</p> : null}
      {subjects.length && terms.length ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <CustomSelect label="Môn học" value={subjectId} disabled={saving || Boolean(course)} options={subjects.map((subject) => ({ value: subject.id, label: subject.vietnameseName || subject.name }))} onValueChange={(value) => { setSubjectId(value); setNotice(""); }} />
          <CustomSelect label="Học kỳ" value={termId} disabled={saving || Boolean(course)} options={terms.map((term) => ({ value: term.id, label: term.name }))} onValueChange={(value) => { setTermId(value); setNotice(""); }} />
        </div>
        {bookLoading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải sổ điểm...</p> : null}
        {view && !bookLoading ? <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <GradebookPolicyFields policy={policy} onChange={setPolicy} disabled={saving || hasMarks || readOnly} />
            <Button variant="plain" type="button" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={!canSave} onClick={() => void save()}>{saving ? "Đang lưu..." : view.book ? "Lưu cấu hình" : "Tạo sổ điểm"}</Button>
          </div>
          {view.book && view.book.resultMode !== "INTERNAL" ? <p className="text-xs text-slate-500">Cấu hình lịch sử: {view.requiredRegular} cột thường xuyên{view.book.specialized ? " (gồm 1 cột chuyên đề)" : ""}, giữa kỳ và cuối kỳ.</p> : null}
          {policy.resultMode === "INTERNAL" ? <p className="text-xs text-slate-500">Trung bình nội bộ lấy các bài đánh giá thường xuyên đã công bố, mỗi bài tính một lần. Luyện tập và thi thử hiển thị riêng.</p> : null}
          <LegacyPurposeReview view={view} onChanged={() => setRefresh((v) => v + 1)} />
          {hasMarks ? <p className="text-xs text-amber-700">Đã có điểm học sinh, không thể thay đổi cấu hình sổ điểm.</p> : null}
          {readOnly ? <p className="text-xs text-amber-700">Lớp, năm học hoặc học kỳ đã kết thúc/khóa.</p> : null}
        </> : null}
      </> : null}
    </>}
  </div>;
}
