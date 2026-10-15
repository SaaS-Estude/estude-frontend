"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { examService } from "@/lib/assessment-api";
import { ApiError } from "@/lib/auth-api";
import { StudyTopicSuggestionsPanel } from "@/components/assessment/study-topic-suggestions-panel";
import { TeacherStudyProgress } from "@/components/assessment/teacher-study-progress";
import {
  StudyAnalysisDetails,
  ReviewLabel,
} from "@/components/assessment/study-analysis-details";
import type { TeacherStudyAnalysis } from "@/types/assessment";

async function loadStudyAnalysis(
  examId: string,
  studentId: string,
  attemptId: string,
) {
  try {
    return await examService.getTeacherStudyAnalysis(
      examId,
      studentId,
      attemptId,
    );
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
    return examService.createTeacherStudyAnalysis(examId, studentId, attemptId);
  }
}

export function StudentInterventionPanel({
  examId,
  studentId,
  attemptId,
}: {
  examId: string;
  studentId: string;
  attemptId: string;
  classId: string;
  subjectId: string;
}) {
  const [analysis, setAnalysis] = useState<TeacherStudyAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisRequest, setAnalysisRequest] = useState(0);
  const [reanalyzing, setReanalyzing] = useState(false);

  async function reloadAnalysis() {
    setAnalysis(await loadStudyAnalysis(examId, studentId, attemptId));
  }

  async function reanalyze() {
    setReanalyzing(true);
    setAnalysisError("");
    try {
      setAnalysis(
        await examService.createTeacherStudyAnalysis(
          examId,
          studentId,
          attemptId,
        ),
      );
    } catch (cause) {
      setAnalysisError(
        cause instanceof Error
          ? cause.message
          : "Không thể phân tích lại bài làm",
      );
    } finally {
      setReanalyzing(false);
    }
  }

  useEffect(() => {
    let live = true;
    setAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError("");
    void loadStudyAnalysis(examId, studentId, attemptId)
      .then((study) => {
        if (live) setAnalysis(study);
      })
      .catch((cause) => {
        if (live)
          setAnalysisError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải phân tích của học sinh",
          );
      })
      .finally(() => {
        if (live) setAnalysisLoading(false);
      });
    return () => {
      live = false;
    };
  }, [examId, studentId, attemptId, analysisRequest]);

  const assessmentOnly =
    analysis?.report.analysisScope === "ASSESSMENT_ONLY" ||
    analysis?.report.aiStatus === "SKIPPED_NO_MATERIAL";
  const topicSuggestions = analysis?.report.topicSuggestions ?? [];
  const reviewedTopicKeys = new Set(
    analysis?.reviews
      .filter((review) => review.targetKey.startsWith("TOPIC:"))
      .map((review) => review.targetKey) ?? [],
  );
  const pendingTopicSuggestions = topicSuggestions.filter(
    (suggestion) =>
      !reviewedTopicKeys.has(`TOPIC:${suggestion.questionId}`),
  );
  const needsTopicSuggestions = Boolean(
    analysis?.rawReport.topicPerformance.some(
      (topic) =>
        topic.topicName === "Kiến thức tổng hợp" && topic.totalQuestions > 0,
    ),
  );
  return (
    <section className="mb-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">
            {assessmentOnly
              ? "Theo dõi nguy cơ học tập"
              : "Phân tích AI cho bài làm cá nhân"}
          </h2>
          {assessmentOnly ? (
            <p className="text-sm text-slate-500">
              Kết quả được tính từ bài kiểm tra; chưa tạo nhận định kiến thức hoặc
              kế hoạch ôn tập vì môn học chưa có tài liệu.
            </p>
          ) : null}
        </div>
        {analysis ? (
          <Button
            size="sm"
            disabled={reanalyzing}
            onClick={() => void reanalyze()}
          >
            <RotateCcw className={`size-4 ${reanalyzing ? "animate-spin" : ""}`} />
            {reanalyzing ? "Đang phân tích..." : "Phân tích lại"}
          </Button>
        ) : null}
      </div>
      {analysisLoading ? (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700"
        >
          Đang tải phân tích của học sinh. Nếu chưa có báo cáo, hệ thống sẽ tạo
          từ bài làm này.
        </p>
      ) : null}
      {analysisError ? (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>{analysisError}</p>
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => setAnalysisRequest((value) => value + 1)}
          >
            Tải lại phân tích
          </Button>
        </div>
      ) : null}
      {analysis ? (
        <div className="space-y-3">
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Phân tích đã được lưu lúc{" "}
            {new Date(analysis.generatedAt).toLocaleString("vi-VN")}. Giáo viên
            và học sinh đang xem cùng dữ liệu này.
          </p>
          <div>
            <h3 className="font-black text-slate-900">
              Phân tích học sinh đang xem
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {analysis.report.exam.title} · {analysis.report.exam.className}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {analysis.report.performance.ungradedEssayCount
                  ? "Điểm phần đã chấm"
                  : "Điểm"}
              </p>
              <p className="mt-1 font-bold text-slate-800">
                {analysis.report.performance.score ?? "Chưa chấm"}/
                {analysis.report.performance.totalPoints}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {analysis.report.performance.ungradedEssayCount
                  ? "Độ chính xác phần đã chấm"
                  : "Độ chính xác"}
              </p>
              <p className="mt-1 font-bold text-slate-800">
                {analysis.report.performance.accuracy}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kết quả
              </p>
              <p className="mt-1 font-bold text-slate-800">
                {analysis.report.performance.correctCount}/
                {analysis.report.performance.totalQuestions} câu đúng
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                Phạm vi phân tích
              </p>
              <p className="mt-1 font-bold text-blue-800">
                {assessmentOnly
                  ? "Chỉ đánh giá nguy cơ"
                  : "Có tài liệu môn học"}
              </p>
            </div>
          </div>
          <details className="group rounded-xl border border-blue-100 bg-blue-50/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none">
              <p className="font-bold text-slate-800">
                Nhận định tổng quan của AI
              </p>
              <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-blue-100 px-4 py-3 text-sm leading-6 text-slate-700">
              <p>{analysis.report.summary}</p>
              {!assessmentOnly ? (
                <ReviewLabel state={analysis.report.reviewStates?.SUMMARY} />
              ) : null}
            </div>
          </details>
          {analysis.report.performance.ungradedEssayCount > 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Còn {analysis.report.performance.ungradedEssayCount} câu tự luận
              chờ chấm. Chưa có kết luận về tổng điểm hoàn chỉnh.
            </p>
          ) : null}
          {analysis.report.performance.snapshotOrigin ===
          "LEGACY_INCOMPLETE" ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Dữ liệu bài làm cũ chưa đủ để xác nhận tiến bộ.
            </p>
          ) : null}
          {analysis.report.performance.needsWarning ? (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              Kết quả hiện tại dưới mức trung bình. Học sinh cần được hỗ trợ.
            </p>
          ) : null}
          {analysis.report.aiStatus === "FALLBACK" ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              AI chưa tạo được phần tổng hợp chi tiết. Thống kê chủ đề và dữ
              liệu đã thu thập vẫn được giữ nguyên.
            </p>
          ) : null}
          {assessmentOnly ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Chỉ hiển thị thống kê nguy cơ từ bài kiểm tra. Các nhận định, gợi
              ý ôn và câu luyện AI cũ đã được ẩn vì môn học chưa có tài liệu.
            </p>
          ) : null}
          {!assessmentOnly &&
          (pendingTopicSuggestions.length > 0 ||
            (needsTopicSuggestions && topicSuggestions.length === 0)) ? (
            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none">
                <div>
                  <p className="font-bold text-slate-800">
                    Xác nhận chủ đề còn thiếu
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {topicSuggestions.length
                      ? `Còn ${pendingTopicSuggestions.length}/${topicSuggestions.length} câu cần xử lý`
                      : "Đang đối chiếu câu hỏi với tài liệu"}
                    {" · "}Bấm để kiểm tra
                  </p>
                </div>
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 p-3">
                <StudyTopicSuggestionsPanel
                  key={attemptId}
                  analysis={analysis}
                  examId={examId}
                  studentId={studentId}
                  attemptId={attemptId}
                  onChanged={reloadAnalysis}
                />
              </div>
            </details>
          ) : null}
          <StudyAnalysisDetails report={analysis.report} />
          <TeacherStudyProgress
            examId={examId}
            studentId={studentId}
            attemptId={attemptId}
          />
        </div>
      ) : null}
    </section>
  );
}
