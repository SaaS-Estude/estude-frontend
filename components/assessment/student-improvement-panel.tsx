"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { learningPlanService } from "@/lib/assessment-api";
import type { LearningImprovementProfile } from "@/types/assessment";

export function StudentImprovementPanel({ planId }: { planId: string }) {
  const [profile, setProfile] = useState<LearningImprovementProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void learningPlanService.getMyImprovement(planId)
      .then((value) => { if (active) setProfile(value); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải kết quả cải thiện"); });
    return () => { active = false; };
  }, [planId]);
  if (error) return <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!profile) return <p className="mt-4 text-sm text-slate-500">Đang tải đánh giá...</p>;
  const after = profile.reassessments.find((item) => item.phase === "AFTER");
  const retention = profile.reassessments.find((item) => item.phase === "RETENTION");
  return <section className="mt-5 rounded-xl border p-4 text-sm"><h3 className="font-black">Đánh giá kết quả theo mục tiêu</h3>
    <p className="mt-1">Mốc ban đầu: {profile.baseline ? `${profile.baseline.correctCount}/${profile.baseline.scorableCount} câu · ${profile.baseline.accuracy}%` : "chưa đủ bằng chứng"}{profile.baseline ? <Link className="ml-2 text-brand-700 underline" href={`/student/attempts/${profile.baseline.sourceAttemptId}/result`}>Mở bài nguồn</Link> : null}</p>
    <p>Ngưỡng giáo viên đã đặt: {profile.plan.targetAccuracyPercent ?? "chưa có"}% · {profile.plan.successCriteria}</p>
    {[after, retention].map((item, index) => <div key={index} className="mt-3 rounded-lg bg-slate-50 p-3"><h4 className="font-bold">{index === 0 ? "Sau lộ trình" : "Duy trì"}</h4>
      {!item ? <p>{index === 0 ? "Chưa được giao bài đánh giá lại." : "Chưa kiểm tra duy trì; không đồng nghĩa không đạt."}</p> : <>
        <p>Đề được giao · tối thiểu {item.minimumQuestions} câu{item.dueAt ? ` · hạn ${new Date(item.dueAt).toLocaleString("vi-VN")}` : ""}</p>
        <Link className="mt-1 inline-block font-semibold text-brand-700 underline" href={`/student/exams/${item.examId}`}>Mở bài đánh giá</Link>
        {item.selectedEvidence ? <p className="mt-2">Bài đã chọn: {item.selectedEvidence.correctCount}/{item.selectedEvidence.scorableCount} câu · {item.selectedEvidence.accuracy ?? "chưa chấm"}% <Link className="text-brand-700 underline" href={`/student/attempts/${item.selectedEvidence.sourceAttemptId}/result`}>Mở bài làm</Link></p> : <p className="mt-2 text-amber-700">{item.candidates.length ? "Đã nộp; chờ giáo viên xác nhận bài tương đương và kết quả." : "Chưa có bài đã nộp; không tính là 0 điểm."}</p>}
        {item.reviewedAt ? <><p className="mt-2 font-semibold">Kết luận: {item.computedStatus === "ACHIEVED_TARGET" ? "Đạt mục tiêu" : item.computedStatus === "IMPROVED_NOT_MET" ? "Có cải thiện, chưa đạt" : item.computedStatus === "NO_IMPROVEMENT" ? "Chưa cải thiện / giảm" : "Chưa đủ bằng chứng"}</p>{item.comparison.deltaPercentagePoints !== null ? <p>Thay đổi: {item.comparison.deltaPercentagePoints >= 0 ? "+" : ""}{item.comparison.deltaPercentagePoints} điểm phần trăm; {item.comparison.baselineQuestions} và {item.comparison.afterQuestions} câu chấm được.</p> : null}{item.comparison.reasons.length ? <p>Lý do chưa đủ: {item.comparison.reasons.join("; ")}</p> : null}{item.commentary ? <p className="mt-2 whitespace-pre-wrap">{item.commentary}</p> : null}</> : null}
      </>}
    </div>)}
    <details className="mt-3"><summary className="cursor-pointer font-semibold">Quá trình học và đánh giá ({profile.timeline.length})</summary><ol className="mt-2 space-y-1">{profile.timeline.map((entry, index) => <li key={index}>{new Date(entry.at).toLocaleString("vi-VN")} · {entry.label}</li>)}</ol></details>
  </section>;
}
