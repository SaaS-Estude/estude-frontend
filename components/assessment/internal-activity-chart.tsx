"use client";

import { useId, useState } from "react";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import {
  assessmentPurposeLabels,
  internalResultText,
  type InternalResultReport,
} from "@/lib/internal-results";

type Activity = InternalResultReport["items"][number];

function chartScore(item: Activity): number | null {
  if (
    !item.publishedAt || item.publicationStatus !== "PUBLISHED" ||
    item.excused || item.evaluationStatus !== "GRADED" ||
    item.score === null || item.normalizedScore === null ||
    !Number.isFinite(item.normalizedScore) ||
    item.normalizedScore < 0 || item.normalizedScore > 10
  ) return null;
  return item.normalizedScore;
}

export function InternalActivityChart({ report }: { report: InternalResultReport }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailId = useId();
  const selected = report.items.find((item) => item.id === selectedId);
  const offset = (report.pagination.page - 1) * report.pagination.pageSize;
  const scoredCount = report.items.filter((item) => chartScore(item) !== null).length;

  if (!report.items.length) {
    return <p className="text-sm text-slate-500">Chưa có bài được giao hoặc kết quả được công bố.</p>;
  }

  return (
    <section className="space-y-3" aria-label="Biểu đồ kết quả từng hoạt động">
      <div>
        <h3 className="font-bold text-slate-950">Điểm theo từng hoạt động</h3>
        <p className="mt-1 text-sm text-slate-500">
          Điểm đã công bố được quy đổi về thang 10. Dấu — là chưa có điểm số để vẽ, không phải điểm 0.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Hiển thị hoạt động {offset + 1}–{offset + report.items.length}/{report.pagination.total} · {scoredCount} bài có điểm số trên trang này.
        </p>
      </div>
      <div className="h-80">
        <BarChart
          items={report.items.map((item, index) => ({
            id: item.id,
            label: `${offset + index + 1}. ${item.title}`,
            shortLabel: `Bài ${offset + index + 1}`,
            value: chartScore(item),
          }))}
          ariaLabel="Điểm từng hoạt động trên thang 10"
          maxValue={10}
          maxItems={report.items.length}
          valueLabel="Điểm quy đổi"
          valueFormatter={(value) => `${value.toFixed(1)}/10`}
        />
      </div>
      {scoredCount === 0 ? (
        <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Chưa có điểm số đã công bố để vẽ cột. Trạng thái từng bài được hiển thị bên dưới.
        </p>
      ) : null}
      <p className="text-xs text-slate-500">Chọn tên bài để xem điểm gốc và nhận xét. Kéo ngang biểu đồ để xem thêm bài.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {report.items.map((item, index) => {
          const score = chartScore(item);
          return (
            <Button
              key={item.id}
              variant="plain"
              type="button"
              aria-expanded={selectedId === item.id}
              aria-controls={detailId}
              onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
              className={`min-w-0 rounded-lg border p-3 text-left text-sm transition-colors ${selectedId === item.id ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span className="block break-words font-semibold text-slate-900">{offset + index + 1}. {item.title}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {internalResultText(item)}{score !== null ? ` · Quy đổi ${score.toFixed(1)}/10` : ""}
              </span>
            </Button>
          );
        })}
      </div>
      <div id={detailId}>
        {selected ? (
          <article className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <h4 className="break-words font-semibold text-slate-950">{selected.title}</h4>
            <p className="text-xs text-slate-500">
              {assessmentPurposeLabels[selected.assessmentPurpose]} · {report.subjects.find((s) => s.id === selected.subjectId)?.name} · {report.terms.find((t) => t.id === selected.termId)?.name}
              {selected.archived ? " · Đã lưu trữ" : ""}
            </p>
            <p className="font-semibold">{internalResultText(selected)}</p>
            {selected.feedback ? <p className="whitespace-pre-wrap text-sm text-slate-600">{selected.feedback}</p> : null}
            <p className="text-xs text-slate-500">
              {selected.excused ? "Được miễn" : selected.completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
              {selected.publishedAt ? ` · Công bố ${new Date(selected.publishedAt).toLocaleDateString("vi-VN")}` : ""}
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
