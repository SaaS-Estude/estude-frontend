"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { SubjectSupportDetail } from "@/components/assessment/subject-support-page";
import { ContentLoading } from "@/components/ui/content-loading";
import { examService } from "@/lib/assessment-api";
import type {
  LearningSupportOverview,
  SubjectSupportReport,
} from "@/types/assessment";

export function LearningSupportScopeLoading() {
  return (
    <AssessmentShell>
      <div className="space-y-4">
        <Link
          href="/teacher/learning-support"
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <ArrowLeft className="size-4" /> Tất cả lớp và môn
        </Link>
        <ContentLoading label="Đang tải đánh giá học tập..." />
      </div>
    </AssessmentShell>
  );
}

export function LearningSupportScopePage() {
  const { classId, subjectId } = useParams<{
    classId: string;
    subjectId: string;
  }>();
  const [scope, setScope] = useState<
    LearningSupportOverview["scopes"][number] | null
  >(null);
  const [report, setReport] = useState<SubjectSupportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setScope(null);
    setReport(null);
    void (async () => {
      const overview = await examService.getLearningSupportOverview();
      const match =
        overview.scopes.find(
          (item) => item.classId === classId && item.subjectId === subjectId,
        ) ?? null;
      if (!active) return;
      setScope(match);
      if (!match?.anchorExamId) return;
      const nextReport = await examService.getSubjectSupport(match.anchorExamId);
      if (active) setReport(nextReport);
    })()
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải môn học",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, subjectId]);

  if (
    !loading &&
    scope?.classId === classId &&
    scope.subjectId === subjectId &&
    scope.anchorExamId &&
    report
  )
    return (
      <SubjectSupportDetail examId={scope.anchorExamId} initialReport={report} />
    );
  if (loading) return <LearningSupportScopeLoading />;
  return (
    <AssessmentShell>
      <div className="space-y-4">
        <Link
          href="/teacher/learning-support"
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <ArrowLeft className="size-4" /> Tất cả lớp và môn
        </Link>
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-card">
          {error ||
            (scope
              ? "Môn này chưa có bài kiểm tra đã công bố để đánh giá nguy cơ."
              : "Không tìm thấy lớp/môn trong phạm vi được phân công.")}
        </p>
      </div>
    </AssessmentShell>
  );
}
