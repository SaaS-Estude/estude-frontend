"use client";

import { CustomSelect } from "@/components/ui/form-control";
import type { GradePolicy } from "@/types/gradebook";

export const defaultGradePolicy: GradePolicy = { resultMode: "INTERNAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false };

export function GradebookPolicyFields({ policy, onChange, disabled = false }: {
  policy: GradePolicy;
  onChange: (policy: GradePolicy) => void;
  disabled?: boolean;
}) {
  return <>
    <div className="grid gap-2 text-sm"><span className="font-bold text-slate-700">Loại sổ điểm</span><span className="flex h-10 items-center text-slate-600">Kết quả nội bộ theo hoạt động</span></div>
    <CustomSelect label="Hình thức đánh giá" value={policy.assessmentMode} disabled={disabled} options={[{ value: "NUMERIC", label: "Điểm số" }, { value: "COMMENT", label: "Đạt / Chưa đạt" }]} onValueChange={(value) => onChange({ ...defaultGradePolicy, assessmentMode: value as GradePolicy["assessmentMode"] })} />
  </>;
}
