"use client";

import { Checkbox, CustomSelect, Input } from "@/components/ui/form-control";
import type { GradePolicy } from "@/types/gradebook";

export const defaultGradePolicy: GradePolicy = { resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false };

export function GradebookPolicyFields({ policy, onChange, disabled = false }: {
  policy: GradePolicy;
  onChange: (policy: GradePolicy) => void;
  disabled?: boolean;
}) {
  return <>
    <CustomSelect label="Loại sổ điểm" value={policy.resultMode ?? "INTERNAL"} disabled={disabled} options={[{ value: "INTERNAL", label: "Kết quả nội bộ theo hoạt động" }, { value: "LEGACY", label: "Kết quả học kỳ (TX/GK/CK)" }]} onValueChange={(value) => onChange({ ...policy, resultMode: value as "INTERNAL" | "LEGACY", ...(value === "INTERNAL" ? { annualPeriods: 35, specialized: false } : {}) })} />
    <CustomSelect label="Hình thức đánh giá" value={policy.assessmentMode} disabled={disabled} options={[{ value: "NUMERIC", label: "Điểm số" }, { value: "COMMENT", label: "Đạt / Chưa đạt" }]} onValueChange={(value) => onChange({ ...policy, assessmentMode: value as GradePolicy["assessmentMode"], specialized: false })} />
    {policy.resultMode !== "INTERNAL" && <label className="grid gap-1 text-xs font-semibold text-slate-600">Số tiết môn học/năm
      <Input className="h-10 w-28" type="number" min={35} max={1000} required value={policy.annualPeriods} disabled={disabled} onChange={(event) => onChange({ ...policy, annualPeriods: Number(event.target.value) })} />
    </label>}
    {policy.resultMode !== "INTERNAL" && policy.assessmentMode === "NUMERIC" && <label className="flex h-10 items-center gap-2 text-sm text-slate-700"><Checkbox checked={policy.specialized} disabled={disabled} onChange={(event) => onChange({ ...policy, specialized: event.target.checked })} />Có điểm cụm chuyên đề</label>}
  </>;
}
