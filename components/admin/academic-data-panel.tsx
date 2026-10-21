"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input, Select } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { academicDataService } from "@/lib/assessment-api";
import type {
  AcademicYear,
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
  const [selectedYearId, setSelectedYearId] = useState("");
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

  const load = useCallback(async () => {
    try {
      const [loadedYears, loadedTerms] = await Promise.all([
        academicDataService.getAcademicYears(true),
        academicDataService.getTerms(undefined, true),
      ]);
      setYears(loadedYears);
      setTerms(loadedTerms);
      setSelectedYearId((current) =>
        current && loadedYears.some((item) => item.id === current)
          ? current
          : (loadedYears.find((item) => item.status === "ACTIVE")?.id ??
            loadedYears[0]?.id ??
            ""),
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
