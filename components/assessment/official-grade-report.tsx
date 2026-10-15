"use client";

import { useEffect, useState } from "react";
import { gradebookService } from "@/lib/gradebook-api";
import type { GradeMark, GradeOutcome, GradeReport } from "@/types/gradebook";

export function formatGrade(mark: GradeMark) {
  return mark === null
    ? "—"
    : mark === "PASS"
      ? "Đạt"
      : mark === "FAIL"
        ? "Chưa đạt"
        : mark.toFixed(1);
}
export function outcomeText(outcome?: GradeOutcome | null) {
  return !outcome?.complete
    ? "Chưa đủ đánh giá"
    : formatGrade(outcome.average ?? outcome.assessment);
}
const levels = {
  TOT: "Tốt",
  KHA: "Khá",
  DAT: "Đạt",
  CHUA_DAT: "Chưa đạt",
  INCOMPLETE: "Chưa đủ đánh giá",
};
const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

function activityGradeText(item: GradeReport["results"][number]["subjects"][number]["semesters"][number]["items"][number]) {
  if (item.publicationStatus !== "PUBLISHED") return "Chưa công bố";
  if (item.evaluationStatus === "MISSING") return "Chưa nộp";
  if (item.evaluationStatus === "EXCUSED") return "Được miễn";
  if (item.evaluationStatus !== "GRADED") return "Chưa chấm";
  if (item.score !== null) return `${item.score} / ${item.maxScore}`;
  return item.assessment === "PASS" ? "Đạt" : item.assessment === "FAIL" ? "Chưa đạt" : "Chưa chấm";
}

export function OfficialGradeReport({
  studentId = "me",
}: {
  studentId?: string;
}) {
  const [data, setData] = useState<GradeReport | null>(null);
  const [error, setError] = useState("");
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("all");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    gradebookService
      .report(studentId)
      .then((report) => {
        if (!active) return;
        setData(report);
        const year =
          report.years.find((item) => item.status === "ACTIVE") ??
          report.years[0];
        setYearId(year?.id ?? "");
        setClassId(
          report.classes.find((item) => item.academicYearId === year?.id)?.id ??
            "",
        );
        setTermId(
          report.terms.find(
            (item) =>
              item.academicYearId === year?.id && item.status === "ACTIVE",
          )?.id ?? "all",
        );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không tải được bảng điểm",
          );
      });
    return () => {
      active = false;
    };
  }, [studentId]);
  if (error)
    return (
      <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
        {error}
      </p>
    );
  if (!data) return <p className="p-4 text-slate-500">Đang tải sổ điểm…</p>;
  const classes = data.classes.filter((item) => item.academicYearId === yearId);
  const terms = data.terms.filter((item) => item.academicYearId === yearId);
  const result = data.results.find(
    (item) => item.classId === classId && item.academicYearId === yearId,
  );
  const level =
    termId === "all"
      ? result?.annualLevel
      : result?.semesterLevels.find((item) => item.termId === termId);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <h2 className="text-lg font-bold text-slate-950">Sổ điểm học sinh</h2>
      <p className="mt-1 text-xs text-slate-500">
        Điểm do giáo viên ghi nhận theo Thông tư 22/2021. Ô trống là chưa đánh
        giá; điểm 0 được hiển thị riêng.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs">
          Năm học
          <select
            aria-label="Năm học sổ điểm"
            className={selectClass}
            value={yearId}
            onChange={(event) => {
              const id = event.target.value;
              setYearId(id);
              setClassId(
                data.classes.find((item) => item.academicYearId === id)?.id ??
                  "",
              );
              setTermId("all");
            }}
          >
            {data.years.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Lớp
          <select
            aria-label="Lớp sổ điểm"
            className={selectClass}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Học kỳ
          <select
            aria-label="Học kỳ sổ điểm"
            className={selectClass}
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="all">Cả năm</option>
            {terms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 font-semibold">
        Kết quả học tập: {level ? levels[level.level] : "Chưa đủ đánh giá"}
        {level?.adjusted ? " (điều chỉnh theo khoản 3 Điều 9)" : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {(termId === "all"
                ? ["Môn học", "Học kỳ I", "Học kỳ II", "Cả năm"]
                : [
                    "Môn học",
                    "Thường xuyên",
                    "Giữa kỳ",
                    "Cuối kỳ",
                    "Kết quả",
                    "Nhận xét",
                  ]
              ).map((title) => (
                <th key={title} className="p-3">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result?.subjects.map((subject) => {
              const semester = subject.semesters.find(
                (item) => item.termId === termId,
              );
              return (
                <tr
                  key={subject.subjectId}
                  className="border-t border-slate-100"
                >
                  <td className="p-3 font-semibold">{subject.subjectName}</td>
                  {termId === "all" ? (
                    <>
                      {[1, 2].map((order) => (
                        <td key={order} className="p-3">
                          {outcomeText(
                            subject.semesters.find(
                              (item) => item.displayOrder === order,
                            )?.outcome,
                          )}
                        </td>
                      ))}
                      <td className="p-3 font-bold">
                        {outcomeText(subject.annual)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3">
                        {semester?.marks?.regular
                          .map(formatGrade)
                          .join(" · ") || "—"}
                      </td>
                      <td className="p-3">
                        {formatGrade(semester?.marks?.midterm ?? null)}
                      </td>
                      <td className="p-3">
                        {formatGrade(semester?.marks?.final ?? null)}
                      </td>
                      <td className="p-3 font-bold">
                        {semester?.policy
                          ? outcomeText(semester.outcome)
                          : "Chưa cấu hình"}
                      </td>
                      <td className="max-w-xs whitespace-pre-wrap p-3">
                        {semester?.comment || "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {termId !== "all" ? <div className="mt-5 space-y-3">
        <h3 className="font-bold text-slate-900">Điểm theo hoạt động</h3>
        {result?.subjects.flatMap((subject) => {
          const semester = subject.semesters.find((item) => item.termId === termId);
          return (semester?.items ?? []).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
            <div><p className="font-semibold">{subject.subjectName} · {item.title}</p><p className="text-xs text-slate-500">{item.sourceType === "ASSIGNMENT" ? "Bài tập" : item.sourceType === "EXAM" ? "Bài kiểm tra" : "Điểm thủ công"}{item.officialSlot ? ` · ${item.officialSlot}` : " · Chưa tính vào TX/GK/CK"}</p></div>
            <span className="font-semibold">{activityGradeText(item)}</span>
          </div>);
        })}
        {!result?.subjects.some((subject) => (subject.semesters.find((item) => item.termId === termId)?.items ?? []).length > 0) ? <p className="text-sm text-slate-500">Chưa có hoạt động chấm điểm trong học kỳ này.</p> : null}
      </div> : null}
      {!result?.subjects.length ? (
        <p className="p-4 text-slate-500">
          Chưa có môn học hoặc sổ điểm trong lớp đã chọn.
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        ĐTB học kỳ = (tổng TX + 2 × GK + 3 × CK) / (số cột TX + 5). ĐTB cả năm =
        (HKI + 2 × HKII) / 3. Môn nhận xét cả năm dùng kết quả HKII. Kết quả học
        tập không phải quyết định lên lớp hay danh hiệu khen thưởng.
      </p>
    </section>
  );
}
