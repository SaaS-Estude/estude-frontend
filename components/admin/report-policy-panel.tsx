"use client";
import { useEffect, useState } from "react";
import { authenticatedRequest } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
type Policy = {
  revision: number;
  absenceLimit: number;
  lowScore: number;
  atRiskScore: number;
};
export function ReportPolicyPanel() {
  const [policy, setPolicy] = useState<Policy | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setPolicy(await authenticatedRequest<Policy>("/reporting/policy"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải cấu hình");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    if (!policy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setPolicy(
        await authenticatedRequest<Policy>("/reporting/policy", {
          method: "PUT",
          body: JSON.stringify(policy),
        }),
      );
      setNotice("Đã lưu ngưỡng cảnh báo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu cấu hình");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">Cảnh báo học lực</h2>
      <p className="mt-2 text-sm text-slate-500">
        Áp dụng ngay cho tổng quan học sinh và phụ huynh của trường. Chỉ sử dụng
        điểm đã công bố và buổi điểm danh đã chốt; chỉ báo hỗ trợ không phải xếp
        loại chính thức.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {!policy && busy ? <p role="status">Đang tải cấu hình…</p> : null}
      {policy && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {(
            [
              {
                key: "absenceLimit",
                label: "Số buổi vắng cảnh báo",
                min: 1,
                max: 1000,
                step: 1,
              },
              {
                key: "lowScore",
                label: "Ngưỡng điểm thấp",
                min: 0,
                max: 10,
                step: 0.1,
              },
              {
                key: "atRiskScore",
                label: "Ngưỡng có nguy cơ",
                min: 0,
                max: 10,
                step: 0.1,
              },
            ] as const
          ).map((v) => (
            <label key={v.key} className="text-sm font-semibold">
              {v.label}
              <input
                type="number"
                min={v.min}
                max={v.max}
                step={v.step}
                value={policy[v.key]}
                onChange={(e) =>
                  setPolicy({ ...policy, [v.key]: Number(e.target.value) })
                }
                className="mt-2 w-full rounded-lg border border-slate-200 p-2"
              />
            </label>
          ))}
        </div>
      )}
      <div className="mt-5 flex gap-3">
        <Button
          disabled={busy || !policy}
          permission="system_settings.update"
          onClick={() => void save()}
        >
          Lưu ngưỡng cảnh báo
        </Button>
        <button
          disabled={busy}
          onClick={() => void load()}
          className="text-sm text-brand-700"
        >
          Tải lại cấu hình
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Điểm theo thang 10; ngưỡng có nguy cơ phải lớn hơn hoặc bằng ngưỡng điểm
        thấp. Số buổi vắng tính riêng từng môn/học kỳ. Phân tích AI được thực
        hiện tại chức năng hỗ trợ học tập.
      </p>
    </section>
  );
}
