"use client";
import { useEffect, useState } from 'react';
import { gradebookService } from '@/lib/gradebook-api';
import { assessmentPurposeLabels, internalResultText, type InternalResultQuery, type InternalResultReport } from '@/lib/internal-results';
import { OfficialGradeReport } from './official-grade-report';
import { Select } from "@/components/ui/form-control";
import { Button } from "@/components/ui/button";


const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
const termLabels: Record<string, string> = { UPCOMING: 'Sắp diễn ra', ACTIVE: 'Đang diễn ra', COMPLETED: 'Đã kết thúc', LOCKED: 'Đã khóa' };
export function InternalGradeReport({ studentId = 'me' }: { studentId?: string }) {
  return <ReportBody key={studentId} studentId={studentId} />;
}
function ReportBody({ studentId }: { studentId: string }) {
  const [data, setData] = useState<InternalResultReport | null>(null);
  const [query, setQuery] = useState<InternalResultQuery>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [legacy, setLegacy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    gradebookService.internalReport(studentId, query).then((report) => {
      if (!active) return;
      setData(report);
      if (!query.academicYearId && report.years.length) {
        const year = report.years.find((y) => y.status === 'ACTIVE') ?? report.years.find((y) => report.rows.some((r) => r.academicYearId === y.id && r.groups.some((g) => g.publishedCount))) ?? report.years[0];
        const schoolClass = report.classes.find((c) => c.academicYearId === year.id);
        const term = report.terms.find((t) => t.academicYearId === year.id && t.status === 'ACTIVE') ?? [...report.terms].filter((t) => t.academicYearId === year.id).sort((a, b) => b.displayOrder - a.displayOrder).find((t) => report.rows.some((r) => r.termId === t.id && r.groups.some((g) => g.publishedCount))) ?? report.terms.find((t) => t.academicYearId === year.id);
        setQuery({ academicYearId: year.id, classId: schoolClass?.id, termId: term?.id, page: 1 });
      }
    }).catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : 'Không tải được kết quả'); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId, query]);
  const terms = data?.terms.filter((t) => t.academicYearId === query.academicYearId) ?? [];
  const classes = data?.classes.filter((c) => c.academicYearId === query.academicYearId) ?? [];
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div><h2 className="text-lg font-bold text-slate-950">Kết quả học tập nội bộ LMS</h2><p className="mt-1 text-sm text-slate-500">Điểm trung bình chỉ tính bài đánh giá thường xuyên đã công bố. Luyện tập và thi thử được theo dõi riêng.</p></div>
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p> : null}
    {data ? <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-xs">Năm học<Select aria-label="Năm học kết quả" className={field} value={query.academicYearId ?? ''} onChange={(e) => { const id = e.target.value; setQuery({ academicYearId: id, classId: data.classes.find((c) => c.academicYearId === id)?.id, termId: data.terms.find((t) => t.academicYearId === id && t.status === 'ACTIVE')?.id, page: 1 }); }}><option value="" disabled>Chọn năm học</option>{data.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></label>
      <label className="grid gap-1 text-xs">Học kỳ<Select aria-label="Học kỳ kết quả" className={field} value={query.termId ?? ''} onChange={(e) => setQuery({ ...query, termId: e.target.value || undefined, subjectId: undefined, page: 1 })}><option value="">Cả hai học kỳ</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name} · {termLabels[t.status]}</option>)}</Select></label>
      <label className="grid gap-1 text-xs">Lớp<Select aria-label="Lớp kết quả" className={field} value={query.classId ?? ''} onChange={(e) => setQuery({ ...query, classId: e.target.value || undefined, subjectId: undefined, page: 1 })}><option value="">Tất cả lớp đã học</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select></label>
      <label className="grid gap-1 text-xs">Môn học<Select aria-label="Môn học kết quả" className={field} value={query.subjectId ?? ''} onChange={(e) => setQuery({ ...query, subjectId: e.target.value || undefined, page: 1 })}><option value="">Tất cả môn</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
    </div> : null}
    {loading ? <p role="status" className="py-8 text-slate-500">Đang tải kết quả…</p> : data ? <>
      {!data.rows.length ? <p className="rounded-lg bg-slate-50 p-5 text-slate-500">Chưa có kết quả trong phạm vi đã chọn.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Môn / học kỳ / lớp</th><th className="p-3">Trung bình nội bộ</th><th className="p-3">Hoàn thành bài giao</th><th className="p-3">Các nhóm kết quả</th></tr></thead><tbody>{data.rows.map((r) => { const regular = r.groups.find((g) => g.purpose === 'REGULAR'); return <tr key={`${r.classId}:${r.termId}:${r.subjectId}`} className="border-t border-slate-100"><td className="p-3 font-semibold">{r.subjectName}<span className="block text-xs font-normal text-slate-500">{data.terms.find((t) => t.id === r.termId)?.name} · {data.classes.find((c) => c.id === r.classId)?.code}</span></td><td className="p-3">{regular?.average === null || regular?.average === undefined ? 'Chưa có điểm công bố' : `${regular.average.toFixed(1)}/10`}<span className="block text-xs text-slate-500">{regular?.scoredCount ?? 0} bài có điểm · {regular?.publishedCount ?? 0} kết quả công bố</span></td><td className="p-3">{r.completedCount}/{r.assignedCount}{r.completionPercentage !== null ? ` (${r.completionPercentage}%)` : ''}{r.excusedCount ? <span className="block text-xs text-slate-500">Miễn {r.excusedCount} bài</span> : null}</td><td className="p-3 text-xs text-slate-500">{r.groups.filter((g) => g.purpose !== 'REGULAR' && g.publishedCount > 0).map((g) => <div key={g.purpose}>{assessmentPurposeLabels[g.purpose]}: {g.average === null ? `${g.passCount} Đạt / ${g.failCount} Chưa đạt` : `${g.average.toFixed(1)}/10`}</div>)}{regular && regular.passCount + regular.failCount > 0 ? <div>{regular.passCount} Đạt / {regular.failCount} Chưa đạt</div> : null}</td></tr>; })}</tbody></table></div>}
      <h3 className="font-bold">Chi tiết từng hoạt động</h3>
      {!data.items.length ? <p className="text-sm text-slate-500">Chưa có bài được giao hoặc kết quả được công bố.</p> : <div className="space-y-2">{data.items.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><div className="font-semibold">{item.title}<span className="block text-xs font-normal text-slate-500">{assessmentPurposeLabels[item.assessmentPurpose]} · {data.subjects.find((s) => s.id === item.subjectId)?.name} · {data.terms.find((t) => t.id === item.termId)?.name}{item.archived ? ' · Đã lưu trữ' : ''}</span></div><div className="text-sm font-semibold">{internalResultText(item)}{item.normalizedScore !== null ? <span className="block text-xs font-normal text-slate-500">Quy đổi {item.normalizedScore.toFixed(1)}/10</span> : null}</div></div>{item.feedback ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.feedback}</p> : null}<p className="mt-1 text-xs text-slate-500">{item.completed ? 'Đã hoàn thành' : item.excused ? 'Được miễn' : 'Chưa hoàn thành'}{item.publishedAt ? ` · Công bố ${new Date(item.publishedAt).toLocaleDateString('vi-VN')}` : ''}</p></article>)}</div>}
      {data.pagination.total > data.pagination.pageSize ? <div className="flex items-center justify-end gap-3 text-sm"><Button variant="plain" type="submit" disabled={data.pagination.page <= 1} onClick={() => setQuery({ ...query, page: data.pagination.page - 1 })}>Trang trước</Button><span>Trang {data.pagination.page}</span><Button variant="plain" type="submit" disabled={data.pagination.page * data.pagination.pageSize >= data.pagination.total} onClick={() => setQuery({ ...query, page: data.pagination.page + 1 })}>Trang sau</Button></div> : null}
      {data.unclassifiedCount > 0 ? <p className="text-xs text-amber-700">Có {data.unclassifiedCount} hoạt động cũ cần phân loại; các điểm này không được cộng vào trung bình nội bộ.</p> : null}
    </> : null}
    <details open={legacy} onToggle={(e) => setLegacy(e.currentTarget.open)} className="border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm text-slate-500">Xem bảng điểm lịch sử theo cấu hình cũ</summary>{legacy ? <OfficialGradeReport studentId={studentId} /> : null}</details>
  </section>;
}
