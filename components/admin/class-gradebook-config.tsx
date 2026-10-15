"use client";
import { LegacyPurposeReview } from "./legacy-purpose-review";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { academicDataService } from "@/lib/assessment-api";
import { gradebookService } from "@/lib/gradebook-api";
import type { SchoolClass, SubjectTeacherAssignment, Term } from "@/types/assessment";
import type { GradebookView, GradePolicy } from "@/types/gradebook";

const field = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 disabled:bg-slate-100";
const defaultPolicy: GradePolicy = { resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false };

export function ClassGradebookConfig({ schoolClass }: { schoolClass: SchoolClass }) {
  const [assignments, setAssignments] = useState<SubjectTeacherAssignment[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [view, setView] = useState<GradebookView | null>(null);
  const [policy, setPolicy] = useState<GradePolicy>(defaultPolicy);
  const [loading, setLoading] = useState(true);
  const [bookLoading, setBookLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  const subjects = useMemo(() => [...new Map(assignments.filter((item) => item.isActive).map((item) => [item.subjectId, item.subject])).values()], [assignments]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      academicDataService.getSubjectTeacherAssignments({ classId: schoolClass.id }),
      academicDataService.getTerms(schoolClass.academicYearId, true),
    ]).then(([loadedAssignments, loadedTerms]) => {
      if (!active) return;
      setAssignments(loadedAssignments);
      setTerms(loadedTerms);
      setSubjectId(loadedAssignments.find((item) => item.isActive)?.subjectId ?? "");
      setTermId((loadedTerms.find((item) => item.status === "ACTIVE") ?? loadedTerms[0])?.id ?? "");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được môn học và học kỳ");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [schoolClass.id, schoolClass.academicYearId]);

  useEffect(() => {
    let active = true;
    setView(null);
    setPolicy(defaultPolicy);
    if (!subjectId || !termId) return;
    setBookLoading(true);
    setError("");
    gradebookService.get({ classId: schoolClass.id, subjectId, termId })
      .then((loaded) => {
        if (!active) return;
        setView(loaded);
        setPolicy(loaded.book ?? defaultPolicy);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được sổ điểm");
      })
      .finally(() => { if (active) setBookLoading(false); });
    return () => { active = false; };
  }, [schoolClass.id, subjectId, termId, refresh]);

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
      await gradebookService.configure({ classId: schoolClass.id, subjectId, termId, ...policy, revision: view.book?.revision ?? 0 });
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
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Môn học
            <select className={field} value={subjectId} disabled={saving} onChange={(event) => { setSubjectId(event.target.value); setNotice(""); }}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.vietnameseName || subject.name}</option>)}</select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">Học kỳ
            <select className={field} value={termId} disabled={saving} onChange={(event) => { setTermId(event.target.value); setNotice(""); }}>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select>
          </label>
        </div>
        {bookLoading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải sổ điểm...</p> : null}
        {view && !bookLoading ? <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Hình thức đánh giá
              <select className={field} value={policy.assessmentMode} disabled={saving || hasMarks || readOnly} onChange={(event) => setPolicy({ ...policy, assessmentMode: event.target.value as GradePolicy["assessmentMode"], specialized: false })}>
                <option value="NUMERIC">Điểm số</option><option value="COMMENT">Đạt / Chưa đạt</option>
              </select>
            </label>
            {policy.resultMode !== "INTERNAL" ? <label className="grid gap-1 text-xs font-semibold text-slate-600">Số tiết môn học/năm
              <input className={`${field} w-28`} type="number" min={35} max={1000} value={policy.annualPeriods} disabled={saving || hasMarks || readOnly} onChange={(event) => setPolicy({ ...policy, annualPeriods: Number(event.target.value) })} />
            </label> : null}
            {policy.resultMode !== "INTERNAL" && policy.assessmentMode === "NUMERIC" ? <label className="flex h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={policy.specialized} disabled={saving || hasMarks || readOnly} onChange={(event) => setPolicy({ ...policy, specialized: event.target.checked })} />Có điểm cụm chuyên đề</label> : null}
            <button type="button" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={!canSave} onClick={() => void save()}>{saving ? "Đang lưu..." : view.book ? "Lưu cấu hình" : "Tạo sổ điểm"}</button>
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
