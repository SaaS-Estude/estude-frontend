"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { CheckCircle2, Edit3, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input, Select, Checkbox } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { academicDataService } from "@/lib/assessment-api";
import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type {
  AcademicYear,
  GradeComponent,
  Subject,
  Term,
} from "@/types/assessment";
import { DateInput } from "@/components/ui/date-range-picker";

type YearStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";
type TermStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "LOCKED";
type DeleteTarget = { kind: "year" | "term"; id: string; label: string } | null;

const currentYear = new Date().getFullYear();
const dateInput = (value?: string, exclusive = false) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(new Date(value).getTime() - (exclusive ? 1 : 0)));
};
const defaultYearForm = {
  name: "",
  startsAt: `${currentYear}-08-01`,
  endsAt: `${currentYear + 1}-07-31`,
  status: "UPCOMING" as YearStatus,
  terms: [{ startsAt: '', endsAt: '' }, { startsAt: '', endsAt: '' }],
};
const defaultTermForm = {
  academicYearId: "",
  name: "",
  startsAt: `${currentYear}-08-01`,
  endsAt: `${currentYear}-12-31`,
  displayOrder: 1,
  status: "UPCOMING" as TermStatus,
};
const yearStatusLabels: Record<YearStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  ACTIVE: "Đang hoạt động",
  COMPLETED: "Đã hoàn tất",
};
const termStatusLabels: Record<TermStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  ACTIVE: "Đang diễn ra",
  COMPLETED: "Đã kết thúc, đang chấm nốt",
  LOCKED: "Đã khóa",
};

export function AcademicDataPanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [yearForm, setYearForm] = useState(defaultYearForm);
  const [termForm, setTermForm] = useState(defaultTermForm);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [closure, setClosure] = useState<{ loading: boolean; canProceed: boolean; issues: Array<{ message: string; count: number; sources: Array<{ id: string; title: string; type: string }> }> } | null>(null);

  useEffect(() => {
    let active = true;
    setClosure(null);
    if (!editingTerm || editingTerm.status === termForm.status || !['COMPLETED', 'LOCKED'].includes(termForm.status)) return;
    setClosure({ loading: true, canProceed: false, issues: [] });
    academicDataService.termClosureChecklist(editingTerm.id, termForm.status as 'COMPLETED' | 'LOCKED').then((value) => {
      if (active) setClosure({ ...value, loading: false });
    }).catch((cause: unknown) => { if (active) setClosure({ loading: false, canProceed: false, issues: [{ message: cause instanceof Error ? cause.message : 'Không kiểm tra được các việc còn tồn', count: 1, sources: [] }] }); });
    return () => { active = false; };
  }, [editingTerm, termForm.status]);

  const activeSubjects = useMemo(
    () => subjects.filter((item) => item.isActive),
    [subjects],
  );

  const load = useCallback(async () => {
    try {
      const [loadedYears, loadedTerms, loadedSubjects] = await Promise.all([
        academicDataService.getAcademicYears(true),
        academicDataService.getTerms(undefined, true),
        academicDataService.getSubjects(),
      ]);
      setYears(loadedYears);
      setTerms(loadedTerms);
      setSubjects(loadedSubjects);
      setSelectedYearId((current) =>
        current && loadedYears.some((item) => item.id === current)
          ? current
          : (loadedYears.find((item) => item.status === "ACTIVE")?.id ??
            loadedYears[0]?.id ??
            ""),
      );
      setSelectedSubjectId((current) =>
        current && loadedSubjects.some((item) => item.id === current)
          ? current
          : (loadedSubjects[0]?.id ?? ""),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải dữ liệu học vụ",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  async function run(action: () => Promise<unknown>, fallback: string) {
    setSaving(true);
    setError("");
    try {
      await action();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
    } finally {
      setSaving(false);
    }
  }
  async function submitYear(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (editingYear)
        await academicDataService.updateAcademicYear(editingYear.id, { name: yearForm.name, status: yearForm.status,
          ...(yearForm.startsAt !== dateInput(editingYear.startsAt) ? { startsAt: yearForm.startsAt } : {}),
          ...(yearForm.endsAt !== dateInput(editingYear.endsAt, editingYear.dateBoundaryMode === 'EXCLUSIVE') ? { endsAt: yearForm.endsAt } : {}),
        });
      else await academicDataService.createAcademicYear(yearForm);
      setEditingYear(null);
      setYearModalOpen(false);
      setYearForm(defaultYearForm);
    }, "Không thể lưu năm học");
  }
  async function submitTerm(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (editingTerm)
        await academicDataService.updateTerm(editingTerm.id, { academicYearId: termForm.academicYearId, name: termForm.name, displayOrder: termForm.displayOrder, status: termForm.status,
          ...(termForm.startsAt !== dateInput(editingTerm.startsAt) ? { startsAt: termForm.startsAt } : {}),
          ...(termForm.endsAt !== dateInput(editingTerm.endsAt, editingTerm.dateBoundaryMode === 'EXCLUSIVE') ? { endsAt: termForm.endsAt } : {}),
        });
      else await academicDataService.createTerm(termForm);
      setEditingTerm(null);
      setTermModalOpen(false);
      setTermForm(defaultTermForm);
    }, "Không thể lưu học kỳ");
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await run(async () => {
      if (deleteTarget.kind === "year")
        await academicDataService.deleteAcademicYear(deleteTarget.id);
      else await academicDataService.deleteTerm(deleteTarget.id);
      setDeleteTarget(null);
    }, "Không thể xóa dữ liệu");
  }

  return (
    <div className="pb-8">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <Header
            title="Năm học"
            description="Không tự động tạo theo ngày hệ thống."
            onAdd={() => {
              setEditingYear(null);
              setYearForm(defaultYearForm);
              setYearModalOpen(true);
            }}
          />
          <div className="mt-4 space-y-2">
            {years.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div>
                  <p className="font-bold">
                    {item.name}{" "}
                    <Badge
                      label={yearStatusLabels[item.status]}
                      status={item.status}
                    />
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dateInput(item.startsAt)} → {dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE")}
                  </p>
                </div>
                <Actions
                  onEdit={() => {
                    setEditingYear(item);
                    setYearForm({
                      name: item.name,
                      startsAt: dateInput(item.startsAt),
                      endsAt: dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE"),
                      status: item.status,
                      terms: defaultYearForm.terms,
                    });
                    setYearModalOpen(true);
                  }}
                  onDelete={() =>
                    setDeleteTarget({
                      kind: "year",
                      id: item.id,
                      label: item.name,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <Header
            title="Học kỳ"
            description="Lịch HK1 và HK2 do quản trị viên nhập. Kết thúc học kỳ vẫn cho phép chấm nốt; khóa kỳ sẽ chốt điểm."
            onAdd={() => {
              setEditingTerm(null);
              setTermForm({
                ...defaultTermForm,
                academicYearId: selectedYearId,
              });
              setTermModalOpen(true);
            }}
          />
          <div className="mt-4 space-y-2">
            {terms.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div>
                  <p className="font-bold">
                    {item.displayOrder}. {item.name}{" "}
                    <Badge
                      label={termStatusLabels[item.status]}
                      status={item.status}
                    />
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {years.find((year) => year.id === item.academicYearId)
                      ?.name ?? "—"}{" "}
                    · {dateInput(item.startsAt)} → {dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE")}
                  </p>
                </div>
                <Actions
                  onEdit={() => {
                    setEditingTerm(item);
                    setTermForm({
                      academicYearId: item.academicYearId,
                      name: item.name,
                      startsAt: dateInput(item.startsAt),
                      endsAt: dateInput(item.endsAt, item.dateBoundaryMode === "EXCLUSIVE"),
                      displayOrder: item.displayOrder,
                      status: item.status,
                    });
                    setTermModalOpen(true);
                  }}
                  onDelete={() =>
                    setDeleteTarget({
                      kind: "term",
                      id: item.id,
                      label: item.name,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </section>
        <details className="xl:col-span-2"><summary className="cursor-pointer text-sm text-slate-500">Cấu hình điểm lịch sử theo hệ số cũ</summary>        <GradeComponentConfiguration
          subjectId={selectedSubjectId}
          subjects={activeSubjects}
          onSubjectChange={setSelectedSubjectId}
        /></details>
      </div>
      <Modal
        open={yearModalOpen}
        title={editingYear ? "Chỉnh sửa năm học" : "Thêm năm học"}
        onClose={() => setYearModalOpen(false)}
        footer={
          <Button permission={editingYear ? 'academic.update' : 'academic.create'} type="submit" form="year-form" disabled={saving}>
            {editingYear ? "Lưu thay đổi" : "Thêm năm học"}
          </Button>
        }
      >
        <form
          id="year-form"
          onSubmit={(event) => void submitYear(event)}
          className="grid gap-4"
        >
          <Input
            label="Tên năm học"
            required
            value={yearForm.name}
            onChange={(event) =>
              setYearForm({ ...yearForm, name: event.target.value })
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput
              label="Ngày bắt đầu"
              type="date"
              required
              value={yearForm.startsAt}
              onChange={(event) =>
                setYearForm({ ...yearForm, startsAt: event.target.value })
              }
            />
            <DateInput
              label="Ngày kết thúc"
              type="date"
              required
              value={yearForm.endsAt}
              onChange={(event) =>
                setYearForm({ ...yearForm, endsAt: event.target.value })
              }
            />
          </div>
          {!editingYear ? yearForm.terms.map((term, index) => <fieldset key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Lịch Học kỳ {index + 1}</legend><DateInput label="Ngày bắt đầu" type="date" required value={term.startsAt} onChange={(e) => setYearForm({ ...yearForm, terms: yearForm.terms.map((t, i) => i === index ? { ...t, startsAt: e.target.value } : t) })} /><DateInput label="Ngày kết thúc" type="date" required value={term.endsAt} onChange={(e) => setYearForm({ ...yearForm, terms: yearForm.terms.map((t, i) => i === index ? { ...t, endsAt: e.target.value } : t) })} /></fieldset>) : null}
          <Select
            label="Trạng thái"
            value={yearForm.status}
            onChange={(event) =>
              setYearForm({
                ...yearForm,
                status: event.target.value as YearStatus,
              })
            }
          >
            <option value="UPCOMING">Sắp diễn ra</option>
            <option value="ACTIVE">Đang hoạt động</option>
            {editingYear ? <option value="COMPLETED">Đã kết thúc (hai học kỳ đã khóa)</option> : null}
          </Select>
        </form>
      </Modal>
      <Modal
        open={termModalOpen}
        title={editingTerm ? "Chỉnh sửa học kỳ" : "Thêm học kỳ"}
        onClose={() => setTermModalOpen(false)}
        footer={
          <Button
            type="submit"
            form="term-form"
            permission={editingTerm ? 'academic.update' : 'academic.create'}
            disabled={saving || editingTerm?.status === "LOCKED" || !!closure && !closure.canProceed}
          >
            {editingTerm ? "Lưu thay đổi" : "Thêm học kỳ"}
          </Button>
        }
      >
        <form
          id="term-form"
          onSubmit={(event) => void submitTerm(event)}
          className="grid gap-4"
        >
          <Select
            label="Năm học"
            required
            value={termForm.academicYearId}
            onChange={(event) =>
              setTermForm({ ...termForm, academicYearId: event.target.value })
            }
          >
            <option value="">Chọn năm học</option>
            {years.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tên học kỳ"
              required
              value={termForm.name}
              onChange={(event) =>
                setTermForm({ ...termForm, name: event.target.value })
              }
            />
            <Input
              label="Thứ tự"
              type="number"
              min={1}
              max={2}
              required
              value={termForm.displayOrder}
              onChange={(event) =>
                setTermForm({
                  ...termForm,
                  displayOrder: Number(event.target.value),
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput
              label="Ngày bắt đầu"
              type="date"
              required
              value={termForm.startsAt}
              onChange={(event) =>
                setTermForm({ ...termForm, startsAt: event.target.value })
              }
            />
            <DateInput
              label="Ngày kết thúc"
              type="date"
              required
              value={termForm.endsAt}
              onChange={(event) =>
                setTermForm({ ...termForm, endsAt: event.target.value })
              }
            />
          </div>
          <Select
            label="Trạng thái"
            value={termForm.status}
            disabled={editingTerm?.status === "LOCKED"}
            onChange={(event) =>
              setTermForm({
                ...termForm,
                status: event.target.value as TermStatus,
              })
            }
          >
            <option value="UPCOMING" disabled={!!editingTerm && editingTerm.status !== "UPCOMING"}>Sắp diễn ra</option>
            <option value="ACTIVE" disabled={editingTerm?.status === "COMPLETED"}>Đang diễn ra</option>
            <option value="COMPLETED" disabled={!editingTerm || editingTerm.status === "UPCOMING"}>Đã kết thúc, cho phép chấm nốt</option>
            <option value="LOCKED" disabled={editingTerm?.status !== "COMPLETED"}>Đã khóa, chỉ xem</option>
          </Select>
          {closure ? <div role="status" className={`rounded-lg p-3 text-sm ${closure.canProceed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{closure.loading ? 'Đang kiểm tra công việc còn tồn…' : closure.canProceed ? 'Đã đủ điều kiện. Hệ thống sẽ kiểm tra lại khi lưu.' : <><p className="font-semibold">Cần xử lý trước khi chốt học kỳ:</p>{closure.issues.map((issue, i) => <div key={i} className="mt-2"><p>{issue.message} ({issue.count})</p>{issue.sources.map((source) => <p key={source.id} className="ml-3 text-xs">{source.title}</p>)}</div>)}</>}</div> : null}
        </form>
      </Modal>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa mềm"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        loading={saving}
        confirmVariant="danger"
        confirmLabel="Xóa mềm"
      >
        <p>
          Dữ liệu <b>{deleteTarget?.label}</b> sẽ được ngừng sử dụng và không
          xóa vật lý.
        </p>
      </ConfirmationDialog>
    </div>
  );
}

function GradeComponentConfiguration({
  subjectId,
  subjects,
  onSubjectChange,
}: {
  subjectId: string;
  subjects: Subject[];
  onSubjectChange: (value: string) => void;
}) {
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [editing, setEditing] = useState<GradeComponent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GradeComponent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    code: "TX",
    name: "Thường xuyên",
    requiredColumns: 3,
    weight: 1,
    teacherCanConfigureCalculation: false,
    sortOrder: 0,
    isActive: true,
  });
  const selectedSubject = subjects.find((item) => item.id === subjectId);
  const totalWeight = components
    .filter((item) => item.isActive)
    .reduce((sum, item) => sum + item.weight, 0);

  const load = useCallback(async () => {
    if (!subjectId) {
      setComponents([]);
      return;
    }
    try {
      setComponents(
        await academicDataService.getGradeComponents({
          subjectId,
          includeInactive: true,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tải cấu hình điểm",
      );
    }
  }, [subjectId]);
  useEffect(() => {
    void load();
    setMessage("");
  }, [load]);
  function edit(item: GradeComponent) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      requiredColumns: item.requiredColumns,
      weight: item.weight,
      teacherCanConfigureCalculation: item.teacherCanConfigureCalculation,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setModalOpen(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!subjectId) return;
    setSaving(true);
    setError("");
    try {
      if (editing)
        await academicDataService.updateGradeComponent(editing.id, form);
      else
        await academicDataService.createGradeComponent({ ...form, subjectId });
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể lưu thành phần điểm",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await academicDataService.deleteGradeComponent(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể xóa thành phần điểm",
      );
    } finally {
      setSaving(false);
    }
  }
  async function validate() {
    if (!subjectId) return;
    setSaving(true);
    setError("");
    try {
      const result =
        await academicDataService.validateGradeConfiguration(subjectId);
      setMessage(`Cấu hình hợp lệ: hệ số TX/GK/CK là 1/2/3 (tổng ${result.totalWeight}).`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Cần cấu hình TX/GK/CK đúng hệ số 1/2/3",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card xl:col-span-2">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Settings2 className="size-5" />
        </div>
        <div>
          <h2 className="font-black">Cấu hình thành phần điểm</h2>
          <p className="mt-1 text-xs text-slate-500">
            Danh mục hệ số THPT: TX = 1, GK = 2, CK = 3. Số cột thực tế và hình thức đánh giá được giáo viên xác nhận tại sổ điểm của từng lớp, học kỳ.
          </p>
        </div>
      </div>
      <div className="mt-5 max-w-md">
        <Select
          label="Môn học"
          value={subjectId}
          onChange={(event) => onSubjectChange(event.target.value)}
        >
          <option value="">Chọn môn học</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {getVietnameseSubjectName(item)}
            </option>
          ))}
        </Select>
      </div>
      {message ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="size-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <span className="font-semibold text-slate-600">
          {selectedSubject ? `Môn ${getVietnameseSubjectName(selectedSubject)} · ` : ""}
          <b
            className={
              totalWeight === 6 ? "text-emerald-700" : "text-amber-600"
            }
          >
            Tổng hệ số: {totalWeight} (chuẩn 6)
          </b>
        </span>
        <div className="flex gap-2">
          <Button permission="academic.update"
            variant="outline"
            size="sm"
            disabled={!subjectId || saving}
            onClick={() => void validate()}
          >
            Kiểm tra hệ số
          </Button>
          <Button permission="academic.create"
            size="sm"
            disabled={!subjectId}
            onClick={() => {
              setEditing(null);
              setForm({
                code: "TX",
                name: "Thường xuyên",
                requiredColumns: 3,
                weight: 1,
                teacherCanConfigureCalculation: false,
                sortOrder: 0,
                isActive: true,
              });
              setModalOpen(true);
            }}
          >
            <Plus className="size-4" />
            Thêm thành phần
          </Button>
        </div>
      </div>
      {!subjectId ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
          Chọn môn học để cấu hình.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3">Thành phần</th>
                <th className="px-3 py-3">Số cột</th>
                <th className="px-3 py-3">Hệ số</th>
                <th className="px-3 py-3">Giáo viên tự cấu hình</th>
                <th className="px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-slate-400"
                  >
                    Chưa có thành phần điểm.
                  </td>
                </tr>
              ) : (
                components.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      !item.isActive
                        ? "bg-slate-50 text-slate-400"
                        : "hover:bg-slate-50/70"
                    }
                  >
                    <td className="px-3 py-3 font-bold">
                      {item.code} · {item.name}
                    </td>
                    <td className="px-3 py-3">{item.requiredColumns}</td>
                    <td className="px-3 py-3 font-bold">{item.weight}</td>
                    <td className="px-3 py-3">
                      {item.teacherCanConfigureCalculation ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                          Cho phép
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Theo hệ thống
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button permission="academic.update"
                        variant="ghost"
                        size="sm"
                        onClick={() => edit(item)}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button permission="academic.delete"
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={modalOpen}
        title={editing ? "Chỉnh sửa thành phần điểm" : "Thêm thành phần điểm"}
        onClose={() => setModalOpen(false)}
        width="max-w-2xl"
        footer={
          <Button permission={editing ? 'academic.update' : 'academic.create'} type="submit" form="component-form" disabled={saving}>
            {editing ? "Lưu thay đổi" : "Thêm thành phần"}
          </Button>
        }
      >
        <form
          id="component-form"
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Mã thành phần (TX, GK hoặc CK)"
              required
              value={form.code}
              onChange={(event) =>
                setForm({ ...form, code: event.target.value.toUpperCase(), weight: ({ TX: 1, GK: 2, CK: 3 } as Record<string, number>)[event.target.value.toUpperCase()] ?? 1, requiredColumns: event.target.value.toUpperCase() === 'TX' ? 3 : 1 })
              }
            />
            <Input
              label="Tên thành phần"
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Số cột điểm yêu cầu"
              type="number"
              min={1}
              max={4}
              required
              value={form.requiredColumns}
              onChange={(event) =>
                setForm({
                  ...form,
                  requiredColumns: Number(event.target.value),
                })
              }
            />
            <Input
              label="Hệ số cố định"
              type="number"
              min={1}
              max={3}
              step="1"
              disabled
              required
              value={form.weight}
              onChange={(event) =>
                setForm({ ...form, weight: Number(event.target.value) })
              }
            />
            <Input
              label="Thứ tự hiển thị"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(event) =>
                setForm({ ...form, sortOrder: Number(event.target.value) })
              }
            />
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-sm">
            <Checkbox
              className="mt-1"
              type="checkbox"
              checked={form.teacherCanConfigureCalculation}
              disabled
              onChange={(event) =>
                setForm({
                  ...form,
                  teacherCanConfigureCalculation: event.target.checked,
                })
              }
            />
            <span>
              <b className="block">
                Cho phép giáo viên cấu hình cách tính chi tiết
              </b>
              <span className="text-xs text-slate-500">
                Giáo viên có thể khai báo cách gộp các cột điểm của thành phần
                này.
              </span>
            </span>
          </label>
        </form>
      </Modal>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa mềm thành phần điểm"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        loading={saving}
        confirmVariant="danger"
        confirmLabel="Xóa mềm"
      >
        <p>
          Thành phần <b>{deleteTarget?.name}</b> sẽ được ngừng sử dụng.
        </p>
      </ConfirmationDialog>
    </section>
  );
}

function Header({
  title,
  description,
  onAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-black">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <Button permission="academic.create" size="sm" onClick={onAdd}>
        <Plus className="size-4" />
        Thêm
      </Button>
    </div>
  );
}
function Actions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button permission="academic.update" variant="ghost" size="sm" aria-label="Chỉnh sửa" onClick={onEdit}>
        <Edit3 className="size-4" />
      </Button>
      <Button permission="academic.delete"
        variant="ghost"
        size="sm"
        className="text-rose-600 hover:bg-rose-50"
        aria-label="Xóa mềm"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
function Badge({ label, status }: { label: string; status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-700"
      : status === "LOCKED"
        ? "bg-rose-100 text-rose-700"
        : status === "COMPLETED"
          ? "bg-slate-200 text-slate-600"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`ml-1 rounded-full px-2 py-1 text-[10px] ${tone}`}>
      {label}
    </span>
  );
}
