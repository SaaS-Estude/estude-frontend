"use client";

import { CustomSelect, Input } from "@/components/ui/form-control";
import type { GradePolicy } from "@/types/gradebook";

export const defaultGradePolicy: GradePolicy = {
  resultMode: "DUAL", assessmentMode: "NUMERIC", annualPeriods: 35, specialized: false,
  regularColumns: 2, regularWeight: 1, midtermWeight: 2, finalWeight: 3,
};

export function gradePolicyValues(policy?: GradePolicy | null): GradePolicy {
  const legacyCount = policy?.assessmentMode === "COMMENT" ? 2 :
    ((policy?.annualPeriods ?? 35) <= 35 ? 2 : (policy?.annualPeriods ?? 35) <= 70 ? 3 : 4) + (policy?.specialized ? 1 : 0);
  return {
    ...defaultGradePolicy,
    assessmentMode: policy?.assessmentMode ?? "NUMERIC",
    annualPeriods: policy?.annualPeriods ?? 35, specialized: policy?.specialized ?? false,
    regularColumns: policy?.regularColumns || legacyCount,
    regularWeight: policy?.regularWeight ?? 1,
    midtermWeight: policy?.midtermWeight ?? 2,
    finalWeight: policy?.finalWeight ?? 3,
  };
}

export function validGradePolicy(policy: GradePolicy): boolean {
  return Number.isInteger(policy.regularColumns) && (policy.regularColumns ?? 0) >= 1 && (policy.regularColumns ?? 0) <= 20 &&
    [policy.regularWeight, policy.midtermWeight, policy.finalWeight].every((weight) => typeof weight === "number" && Number.isFinite(weight) && weight > 0 && weight <= 100);
}

export function GradebookPolicyFields({ policy, onChange, disabled = false, structureLocked = false }: {
  policy: GradePolicy; onChange: (policy: GradePolicy) => void; disabled?: boolean; structureLocked?: boolean;
}) {
  const value = { ...defaultGradePolicy, ...policy };
  function change(key: keyof GradePolicy, next: number) { onChange({ ...value, [key]: next }); }
  return <div className="w-full space-y-3">
    <p className="text-sm text-slate-600">Sổ điểm học kỳ và kết quả tự học được theo dõi riêng. Cấu hình dưới đây chỉ áp dụng cho điểm học kỳ của môn/lớp/học kỳ đang chọn.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <CustomSelect label="Hình thức đánh giá học kỳ" value={value.assessmentMode} disabled={disabled || structureLocked}
        options={[{ value: "NUMERIC", label: "Điểm số" }, { value: "COMMENT", label: "Đạt / Chưa đạt" }]}
        onValueChange={(mode) => onChange({ ...value, assessmentMode: mode as GradePolicy["assessmentMode"], specialized: mode === "COMMENT" ? false : value.specialized })} />
      <Input label="Số cột thường kỳ" type="number" min={1} max={20} step={1} required disabled={disabled || structureLocked}
        value={value.regularColumns} onChange={(event) => change("regularColumns", Number(event.target.value))} />
      {value.assessmentMode === "NUMERIC" ? ([
        ["regularWeight", "Hệ số thường kỳ"], ["midtermWeight", "Hệ số giữa kỳ"], ["finalWeight", "Hệ số cuối kỳ"],
      ] as const).map(([key, label]) => <Input key={key} label={label} type="number" min={0.1} max={100} step={0.1} required
        disabled={disabled} value={value[key]} onChange={(event) => change(key, Number(event.target.value))} />) : null}
    </div>
    <p className="text-xs text-slate-500">
      {value.regularColumns} cột thường kỳ, 1 giữa kỳ, 1 cuối kỳ.
      {value.assessmentMode === "NUMERIC" ? ` Mỗi điểm thường kỳ hệ số ${value.regularWeight}, giữa kỳ ${value.midtermWeight}, cuối kỳ ${value.finalWeight}.` : ""}
      {structureLocked ? " Đã có điểm học kỳ: không thay đổi số cột hoặc hình thức đánh giá." : ""} Thay hệ số sẽ tính lại trung bình học kỳ theo cấu hình mới.
    </p>
  </div>;
}
