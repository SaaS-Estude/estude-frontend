"use client";

import { BarChart3, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReportOverviewDashboard } from "@/components/assessment/submissions-page";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/permissions-context";
import { examService } from "@/lib/assessment-api";
import type { ExamClassReport } from "@/types/assessment";

const numberFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function ExamResultsOverview({ examId, totalPoints }: { examId: string; totalPoints: number }) {
  const router = useRouter();
  const { can, loading: permissionsLoading } = usePermissions();
  const canView = can("exams.submissions");
  const [report, setReport] = useState<ExamClassReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (permissionsLoading || !canView) return;
    let active = true;
    setLoading(true);
    setError("");
    void examService
      .getClassReport(examId)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải thống kê bài kiểm tra.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, canView, permissionsLoading, reload]);

  if (!permissionsLoading && !canView) {
    return <p className="rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500">Bạn chưa có quyền xem thống kê bài kiểm tra.</p>;
  }
  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card" role="alert">
        <p className="text-[13px] text-rose-600">{error}</p>
        <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (permissionsLoading || loading || !report) {
    return (
      <div role="status" className="flex min-h-60 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-[13px] text-slate-500 shadow-card">
        <LoaderCircle className="size-4 animate-spin" />
        Đang tải thống kê kết quả...
      </div>
    );
  }

  const { summary } = report;
  const metrics = [
    { label: "Học sinh trong lớp", value: summary.enrolledStudentCount },
    { label: "Đã nộp bài", value: summary.submittedStudentCount },
    {
      label: "Điểm trung bình",
      value: summary.averageScore === null ? "—" : `${numberFormat.format(summary.averageScore)}/${numberFormat.format(totalPoints)}`,
    },
    {
      label: "Thời gian trung bình",
      value: summary.averageDurationSeconds === null ? "—" : `${numberFormat.format(summary.averageDurationSeconds / 60)} phút`,
    },
  ];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <BarChart3 className="size-4 text-brand-600" />
        <h2>Thống kê kết quả</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
            <dt className="text-[13px] text-slate-500">{metric.label}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{metric.value}</dd>
          </div>
        ))}
      </dl>
      {summary.ungradedSubmittedAttemptCount > 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">{summary.ungradedSubmittedAttemptCount} bài nộp còn câu tự luận chưa chấm nên chưa được đưa vào thống kê điểm.</p> : null}
      <ReportOverviewDashboard report={report} compact />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-card" aria-labelledby="exam-ai-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="exam-ai-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="size-4 text-brand-600" />
              Phân tích AI
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">{summary.submittedStudentCount === 0 ? "Cần ít nhất một học sinh nộp bài để phân tích." : "Phân tích kết quả, xác định nội dung cần củng cố và gợi ý hoạt động cho lớp."}</p>
          </div>
          <Button permission="exams.submissions" variant="secondary" className="!text-[13px]" onClick={() => router.push(`/teacher/exams/${examId}/analysis`)}>
            <Sparkles className="size-4" />
            Mở phân tích AI
          </Button>
        </div>
      </section>
    </div>
  );
}
