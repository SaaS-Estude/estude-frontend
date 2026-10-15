"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Filter, LoaderCircle, RefreshCw, Search, Upload } from "lucide-react";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeader } from "@/components/ui/data-table";
import { DataTableFooter } from "@/components/ui/data-table-footer";
import { CustomSelect, Input } from "@/components/ui/form-control";
import { academicDataService } from "@/lib/assessment-api";
import { gradebookService } from "@/lib/gradebook-api";
import { matchesSearchKeyword, normalizeSearchKeyword } from "@/lib/search-keyword";
import type { TeacherAssignedClass, Term } from "@/types/assessment";
import type {
  GradebookView,
  GradeImportPreview,
  GradeMark,
  GradeMarks,
  GradePolicy,
} from "@/types/gradebook";
import { outcomeText } from "@/components/assessment/official-grade-report";
import { usePermissions } from "@/context/permissions-context";
import { InternalGradebookPanel } from "./internal-gradebook-panel";
import { UnifiedGradeItems } from "@/components/teacher/unified-grade-items";

const field =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "NOT_STARTED", label: "Chưa nhập" },
  { value: "IN_PROGRESS", label: "Đang nhập" },
  { value: "COMPLETE", label: "Đủ điểm" },
];

function emptyMarks(count: number, record?: GradeMarks | null): GradeMarks {
  return {
    regular: Array.from({ length: count }, (_, index) => record?.regular[index] ?? null),
    midterm: record?.midterm ?? null,
    final: record?.final ?? null,
  };
}

function markText(mark: GradeMark): string {
  if (mark === "PASS") return "Đạt";
  if (mark === "FAIL") return "Chưa đạt";
  return mark === null ? "—" : String(mark);
}

function validMarks(marks: GradeMarks, mode: GradePolicy["assessmentMode"]): boolean {
  return [...marks.regular, marks.midterm, marks.final].every((mark) => {
    if (mark === null) return true;
    if (mode === "COMMENT") return mark === "PASS" || mark === "FAIL";
    return typeof mark === "number" && Number.isFinite(mark) && mark >= 0 && mark <= 10 && Math.round(mark * 10) === mark * 10;
  });
}
export function LegacyGradebookPanel({
  schoolClass,
}: {
  schoolClass: TeacherAssignedClass;
}) {
  const { can } = usePermissions();
  const canWrite = can("teaching.update") || can("academic.update");
  const [terms, setTerms] = useState<Term[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState(schoolClass.subjects[0]?.id ?? "");
  const [view, setView] = useState<GradebookView | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compactFilters, setCompactFilters] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftSubjectId, setDraftSubjectId] = useState(subjectId);
  const [draftTermId, setDraftTermId] = useState(termId);
  const [draftStatusFilter, setDraftStatusFilter] = useState("");
  const filterBarRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [entryMode, setEntryMode] = useState<"manual" | "excel">("manual");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<GradeImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState("");
  const [marks, setMarks] = useState<GradeMarks>({
    regular: [],
    midterm: null,
    final: null,
  });
  const [comment, setComment] = useState("");
  const firstSubjectId = schoolClass.subjects[0]?.id ?? "";
  const defaultTermId = (terms.find((item) => item.status === "ACTIVE") ?? terms[0])?.id ?? "";
  const hasActiveFilters = Boolean(statusFilter || subjectId !== firstSubjectId || (defaultTermId && termId !== defaultTermId));
  useEffect(() => {
    const bar = filterBarRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(([entry]) => {
      const compact = entry.contentRect.width < 1050;
      setCompactFilters(compact);
      if (!compact) setFilterOpen(false);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!filterOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!filterButtonRef.current?.contains(target) && !filterPopupRef.current?.contains(target)) setFilterOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterOpen]);
  function openFilters() {
    setDraftSubjectId(subjectId);
    setDraftTermId(termId);
    setDraftStatusFilter(statusFilter);
    setFilterOpen(true);
  }
  function applyFilters() {
    setSubjectId(draftSubjectId);
    setTermId(draftTermId);
    setStatusFilter(draftStatusFilter);
    setPage(1);
    setNotice("");
    setFilterOpen(false);
  }
  useEffect(() => {
    setSubjectId(firstSubjectId);
    setSearch("");
    setStatusFilter("");
    setPage(1);
  }, [schoolClass.id, firstSubjectId]);
  useEffect(() => {
    let active = true;
    setTermsLoading(true);
    setTermId("");
    academicDataService
      .getTerms(schoolClass.academicYearId, true)
      .then((items) => {
        if (!active) return;
        setTerms(items);
        setTermId(
          (items.find((item) => item.status === "ACTIVE") ?? items[0])?.id ??
            "",
        );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không tải được học kỳ",
          );
      })
      .finally(() => { if (active) setTermsLoading(false); });
    return () => {
      active = false;
    };
  }, [schoolClass.academicYearId]);
  useEffect(() => {
    let active = true;
    setView(null);
    setEditing("");
    setError("");
    setLoading(Boolean(termId && subjectId));
    if (termId && subjectId)
      gradebookService
        .get({ classId: schoolClass.id, subjectId, termId })
        .then((data) => {
          if (!active) return;
          setView(data);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "Không tải được sổ điểm",
            );
        })
        .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
    };
  }, [schoolClass.id, termId, subjectId, refresh]);
  useEffect(() => {
    setEntryMode("manual");
    setImportFile(null);
    setImportPreview(null);
  }, [subjectId, termId]);
  const historicalReadOnly = view?.year?.status === "COMPLETED" || view?.schoolClass?.isActive === false;
  const baseLocked =
    !canWrite ||
    saving ||
    !view ||
    historicalReadOnly ||
    ["COMPLETED", "LOCKED"].includes(view.term.status);
  const legacyManualLocked = (view?.items ?? []).some((item) => item.officialSlot && item.sourceType !== "MANUAL");
  const locked = baseLocked || legacyManualLocked;
  const requiredRegular = view?.requiredRegular ?? 0;
  const specialized = view?.book?.specialized ?? false;
  const filteredStudents = (view?.students ?? []).filter((student) => {
    const status = student.outcome?.complete ? "COMPLETE" : student.record ? "IN_PROGRESS" : "NOT_STARTED";
    return (!statusFilter || status === statusFilter) &&
      matchesSearchKeyword(normalizeSearchKeyword(student.fullName, student.accountName), search);
  });
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  async function save() {
    if (!view?.book || !editing || locked) return;
    if (!validMarks(marks, view.book.assessmentMode)) {
      setError("Điểm cần nằm trong khoảng 0–10 và có tối đa một chữ số thập phân.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await gradebookService.save(view.book.id, {
        studentId: editing,
        marks,
        comment,
        revision: view.book.revision,
      });
      setEditing("");
      setRefresh((value) => value + 1);
      setNotice("Đã lưu điểm và nhận xét.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  }
  async function downloadTemplate() {
    if (!view?.book) return;
    setImportBusy("download");
    setError("");
    try {
      const blob = await gradebookService.downloadImportTemplate(view.book.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mau-nhap-diem-${schoolClass.code ?? schoolClass.id}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được tệp mẫu");
    } finally {
      setImportBusy("");
    }
  }
  async function previewExcel() {
    if (!view?.book || !importFile) return;
    setImportBusy("preview");
    setError("");
    setNotice("");
    setImportPreview(null);
    try {
      setImportPreview(await gradebookService.previewImport(view.book.id, importFile));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không kiểm tra được tệp Excel");
    } finally {
      setImportBusy("");
    }
  }
  async function importExcel() {
    if (!view?.book || !importPreview || importPreview.errors.length || !importPreview.changedRows) return;
    setImportBusy("save");
    setError("");
    try {
      const result = await gradebookService.saveBulk(view.book.id, importPreview.revision,
        importPreview.rows.map(({ studentId, marks, comment }) => ({ studentId, marks, comment })));
      setImportPreview(null);
      setImportFile(null);
      setEntryMode("manual");
      setRefresh((value) => value + 1);
      setNotice(`Đã nhập điểm cho ${result.count} học sinh.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được điểm từ Excel");
    } finally {
      setImportBusy("");
    }
  }
  function markInput(
    value: GradeMark,
    label: string,
    onChange: (mark: GradeMark) => void,
  ) {
    return (
      <>
        {view?.book?.assessmentMode === "COMMENT" ? (
          <select
            aria-label={label}
            className={`${field} w-24 px-1`}
            disabled={locked}
            value={value ?? ""}
            onChange={(event) =>
              onChange((event.target.value || null) as GradeMark)
            }
          >
            <option value="">Chưa đánh giá</option>
            <option value="PASS">Đạt</option>
            <option value="FAIL">Chưa đạt</option>
          </select>
        ) : (
          <input
            aria-label={label}
            className={`${field} w-16 px-2 text-center`}
            disabled={locked}
            type="number"
            min={0}
            max={10}
            step={0.1}
            inputMode="decimal"
            value={value ?? ""}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        )}
      </>
    );
  }
  return (
    <section className="space-y-4 py-1">
      <div className="relative rounded-xl border border-slate-200 bg-white shadow-card">
        <div ref={filterBarRef} className="relative flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="min-w-52 flex-1">
            <Input icon={Search} aria-label="Tìm học sinh" value={search} disabled={Boolean(editing)} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc tài khoản" className="!h-[42px] !rounded-lg focus:!ring-0" />
          </div>
          {!compactFilters ? (
            <div className="flex min-w-0 flex-[3] gap-3">
              <CustomSelect className="min-w-0 flex-[2]" value={subjectId} options={schoolClass.subjects.map((subject) => ({ value: subject.id, label: subject.vietnameseName || subject.name }))} disabled={saving || Boolean(editing) || !schoolClass.subjects.length} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo môn học" placeholder="Chưa có môn học" onValueChange={(value) => { setSubjectId(value); setPage(1); setNotice(""); }} />
              <CustomSelect className="min-w-0 flex-1" value={termId} options={terms.map((term) => ({ value: term.id, label: term.name }))} disabled={saving || Boolean(editing) || termsLoading || !terms.length} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo học kỳ" placeholder="Chưa có học kỳ" onValueChange={(value) => { setTermId(value); setPage(1); setNotice(""); }} />
              <CustomSelect className="min-w-0 flex-1" value={statusFilter} options={statusOptions} disabled={Boolean(editing)} buttonClassName="!h-[42px] !rounded-lg !ring-0" ariaLabel="Lọc theo trạng thái điểm" onValueChange={(value) => { setStatusFilter(value); setPage(1); }} />
            </div>
          ) : (
            <button ref={filterButtonRef} type="button" aria-expanded={filterOpen} aria-controls="gradebook-filter-popup" className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => filterOpen ? setFilterOpen(false) : openFilters()}>
              Bộ lọc<span className="relative"><Filter className="size-4" />{hasActiveFilters ? <span className="absolute -right-1 -top-1 size-2 rounded-full bg-orange-500" /> : null}</span>
            </button>
          )}
          <button type="button" className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={saving || Boolean(editing) || loading} onClick={() => { setNotice(""); setRefresh((value) => value + 1); }}>
            <RefreshCw className="size-4" />Tải lại
          </button>
          <button type="button" aria-pressed={entryMode === "excel"} className={`inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold disabled:opacity-50 ${entryMode === "excel" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} disabled={!view?.book || loading || Boolean(editing) || Boolean(importBusy)} onClick={() => setEntryMode((mode) => mode === "excel" ? "manual" : "excel")}>
            <FileSpreadsheet className="size-4" />Import Excel
          </button>
          {compactFilters && filterOpen ? (
            <div ref={filterPopupRef} id="gradebook-filter-popup" className="absolute right-3 top-full z-50 mt-1 w-[calc(100%_-_1.5rem)] max-w-[480px] rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span className="text-sm font-bold text-amber-600">Bộ lọc</span>
                <button type="button" aria-label="Đặt lại bộ lọc" className="rounded-md p-1 text-amber-600 hover:bg-amber-50" onClick={() => { setDraftSubjectId(firstSubjectId); setDraftTermId(defaultTermId); setDraftStatusFilter(""); }}><RefreshCw className="size-4" /></button>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <CustomSelect label="Môn học" value={draftSubjectId} options={schoolClass.subjects.map((subject) => ({ value: subject.id, label: subject.vietnameseName || subject.name }))} disabled={saving || Boolean(editing) || !schoolClass.subjects.length} ariaLabel="Lọc theo môn học" placeholder="Chưa có môn học" onValueChange={setDraftSubjectId} />
                <CustomSelect label="Học kỳ" value={draftTermId} options={terms.map((term) => ({ value: term.id, label: term.name }))} disabled={saving || Boolean(editing) || termsLoading || !terms.length} ariaLabel="Lọc theo học kỳ" placeholder="Chưa có học kỳ" onValueChange={setDraftTermId} />
                <CustomSelect label="Trạng thái" value={draftStatusFilter} options={statusOptions} disabled={Boolean(editing)} ariaLabel="Lọc theo trạng thái điểm" onValueChange={setDraftStatusFilter} />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
                <button type="button" className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-700" onClick={() => setFilterOpen(false)}>Hủy</button>
                <button type="button" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || Boolean(editing) || termsLoading} onClick={applyFilters}>Áp dụng</button>
              </div>
            </div>
          ) : null}
        </div>
      {error ? (
        <p role="alert" className="m-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="m-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {loading || termsLoading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin" />Đang tải sổ điểm...</div> : null}
      {!loading && !termsLoading && !termId && !error ? <p className="m-3 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có học kỳ cho lớp này.</p> : null}
      {!loading && view && !view.book ? (
        <p className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Quản trị viên chưa cấu hình sổ điểm cho môn học và học kỳ này.</p>
      ) : null}
      {!loading && view && view.pendingGradeItemCount > 0 ? (
        <p className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {view.pendingGradeItemCount} hoạt động đã công bố đang chờ cấu hình sổ điểm. Quản trị viên cần cấu hình sổ điểm đúng lớp, môn và học kỳ; hệ thống không tự chọn chính sách đánh giá.
        </p>
      ) : null}
      {view?.book ? (
        <>
          <UnifiedGradeItems view={view} disabled={baseLocked} onChanged={(message) => { setNotice(message); setRefresh((value) => value + 1); }} onError={setError} />
          {legacyManualLocked ? <p className="m-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Một cột TX/GK/CK đang lấy điểm từ bài tập hoặc bài kiểm tra. Sửa điểm ở hoạt động gốc; bảng nhập tay/Excel bên dưới chỉ để xem.</p> : null}
          {view.book && entryMode === "excel" ? <div className="m-3 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div><h3 className="font-bold text-slate-900">Nhập điểm từ Excel</h3><p className="mt-1 text-sm text-slate-500">Tải tệp mẫu của lớp này, điền điểm vào các cột, sau đó kiểm tra dữ liệu trước khi lưu. Ô trống được xem là chưa đánh giá.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-brand-700 disabled:opacity-50" disabled={Boolean(importBusy)} onClick={() => void downloadTemplate()}><Download className="size-4" />Tải tệp mẫu</button>
              <label className="grid min-w-56 flex-1 gap-1 text-xs font-bold text-slate-600">Tệp điểm .xlsx
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:font-bold file:text-brand-700" disabled={locked || Boolean(importBusy)} onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); setError(""); }} />
              </label>
              <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={locked || Boolean(importBusy) || !importFile} onClick={() => void previewExcel()}><Upload className="size-4" />{importBusy === "preview" ? "Đang kiểm tra..." : "Kiểm tra tệp"}</button>
            </div>
            {importPreview ? <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-700">Đã đọc {importPreview.totalRows} học sinh · {importPreview.changedRows} học sinh có thay đổi · {importPreview.errors.length} dòng lỗi</p>
              {importPreview.errors.length ? <div role="alert" className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{importPreview.errors.map((item) => <p key={`${item.row}-${item.message}`}>Dòng {item.row}: {item.message}</p>)}</div> : null}
              {importPreview.rows.length ? <div className="max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[600px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr><th className="p-2">Dòng</th><th className="p-2">Học sinh</th><th className="p-2">Điểm / đánh giá</th><th className="p-2">Nhận xét</th></tr></thead><tbody>{importPreview.rows.map((item) => <tr key={item.studentId} className="border-t border-slate-100"><td className="p-2">{item.row}</td><td className="p-2 font-semibold">{item.fullName}<span className="ml-1 text-slate-400">{item.accountName}</span></td><td className="p-2">{[...item.marks.regular, item.marks.midterm, item.marks.final].map(markText).join(" · ")}</td><td className="p-2">{item.comment || "—"}</td></tr>)}</tbody></table></div> : null}
              <button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={locked || Boolean(importBusy) || importPreview.errors.length > 0 || importPreview.changedRows === 0 || importPreview.revision !== view.book.revision} onClick={() => void importExcel()}>{importBusy === "save" ? "Đang lưu..." : `Lưu ${importPreview.changedRows} học sinh`}</button>
              {importPreview.errors.length ? <p className="text-xs text-rose-700">Sửa các dòng lỗi trong Excel rồi kiểm tra lại; hệ thống chưa lưu điểm nào.</p> : null}
            </div> : null}
          </div> : null}
          {entryMode === "manual" ? (
          <div>
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader className="!bg-brand-600 !text-white"><tr>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead className="min-w-44">Học sinh</TableHead>
                  <TableHead className="min-w-32">Tài khoản</TableHead>
                  {Array.from({ length: requiredRegular }, (_, index) => <TableHead key={index} className="min-w-20 text-center">{specialized && index === requiredRegular - 1 ? "Chuyên đề" : `TX ${index + 1}`}</TableHead>)}
                  <TableHead className="min-w-20 text-center">Giữa kỳ</TableHead><TableHead className="min-w-20 text-center">Cuối kỳ</TableHead>
                  <TableHead className="min-w-32 text-center">Kết quả</TableHead><TableHead className="min-w-36">Nhận xét</TableHead><TableHead className="min-w-28 text-right">Thao tác</TableHead>
                </tr></TableHeader>
                <TableBody>
                  {!filteredStudents.length ? <TableEmptyRow colSpan={requiredRegular + 8} message={view.students.length ? "Không tìm thấy học sinh phù hợp với bộ lọc" : "Lớp chưa có học sinh đang học"} /> : null}
                  {pagedStudents.map((student, index) => {
                    const isEditing = editing === student.id;
                    const current = isEditing ? marks : emptyMarks(requiredRegular, student.record?.marks);
                    const state = student.outcome?.complete ? "Đủ điểm" : student.record ? "Đang nhập" : "Chưa nhập";
                    return <tr key={student.id} className={`transition ${isEditing ? "bg-blue-50/70" : "hover:bg-slate-50/70"}`}>
                      <TableCell className="text-center text-xs text-slate-400">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                      <TableCell><p className="font-bold text-slate-900">{student.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{state}</p></TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-600">{student.accountName}</TableCell>
                      {current.regular.map((mark, markIndex) => <TableCell key={markIndex} className="text-center">{isEditing ? markInput(mark, `${student.fullName} ${specialized && markIndex === requiredRegular - 1 ? "chuyên đề" : `TX ${markIndex + 1}`}`, (value) => setMarks((previous) => ({ ...previous, regular: previous.regular.map((old, position) => position === markIndex ? value : old) }))) : markText(mark)}</TableCell>)}
                      <TableCell className="text-center">{isEditing ? markInput(current.midterm, `${student.fullName} giữa kỳ`, (value) => setMarks((previous) => ({ ...previous, midterm: value }))) : markText(current.midterm)}</TableCell>
                      <TableCell className="text-center">{isEditing ? markInput(current.final, `${student.fullName} cuối kỳ`, (value) => setMarks((previous) => ({ ...previous, final: value }))) : markText(current.final)}</TableCell>
                      <TableCell className="text-center font-bold text-slate-800">{outcomeText(student.outcome)}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-slate-500" title={student.record?.comment ?? ""}>{student.record?.comment || "—"}</TableCell>
                      <TableCell className="text-right">{isEditing ? <div className="flex justify-end gap-2"><button type="button" className="font-bold text-brand-700 disabled:opacity-50" disabled={locked} onClick={() => void save()}>{saving ? "Đang lưu..." : "Lưu"}</button><button type="button" className="text-slate-500 disabled:opacity-50" disabled={saving} onClick={() => setEditing("")}>Hủy</button></div> : canWrite && !historicalReadOnly && !legacyManualLocked && !["COMPLETED", "LOCKED"].includes(view.term.status) ? <button type="button" className="font-bold text-brand-700 hover:underline disabled:text-slate-400" disabled={Boolean(editing) || saving} onClick={() => { setEditing(student.id); setMarks(emptyMarks(requiredRegular, student.record?.marks)); setComment(student.record?.comment ?? ""); setNotice(""); setError(""); }}>{student.record ? "Sửa điểm" : "Nhập điểm"}</button> : null}</TableCell>
                    </tr>;
                  })}
                </TableBody>
              </Table>
            </div>
            {editing ? <div className="flex flex-wrap items-end gap-3 border-t border-blue-100 bg-blue-50/40 p-3"><label className="grid min-w-64 flex-1 gap-1 text-xs font-bold text-slate-600">Nhận xét cho {view.students.find((student) => student.id === editing)?.fullName}<textarea className="min-h-16 rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-brand-400" maxLength={2000} disabled={saving} value={comment} onChange={(event) => setComment(event.target.value)} /></label><p className="max-w-xs text-xs text-slate-500">Để trống cột chưa đánh giá. Cột trống không được tính là điểm 0.</p></div> : null}
            {editing ? <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Lưu hoặc hủy điểm đang nhập để chuyển trang.</p> : <DataTableFooter rowCount={pagedStudents.length} totalItems={filteredStudents.length} itemLabel="học sinh" page={currentPage} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
          </div>
          ) : null}
        </>
      ) : null}
      </div>
    </section>
  );
}

export function GradebookPanel({ schoolClass }: { schoolClass: TeacherAssignedClass }) {
  const [legacy, setLegacy] = useState(false);
  return <div className="space-y-4"><InternalGradebookPanel key={schoolClass.id} schoolClass={schoolClass} /><details open={legacy} onToggle={(e) => setLegacy(e.currentTarget.open)}><summary className="cursor-pointer text-sm text-slate-500">Bảng điểm lịch sử theo cấu hình cũ</summary>{legacy ? <LegacyGradebookPanel key={schoolClass.id} schoolClass={schoolClass} /> : null}</details></div>;
}
