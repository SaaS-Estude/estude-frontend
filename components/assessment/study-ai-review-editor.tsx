"use client";

import { useState } from "react";
import { examService } from "@/lib/assessment-api";
import { Button } from "@/components/ui/button";
import type { StudyAiReview, TeacherStudyAnalysis } from "@/types/assessment";
import { Select, Textarea } from "@/components/ui/form-control";


export function StudyAiReviewEditor({ analysis, examId, studentId, attemptId, onChanged }: {
  analysis: TeacherStudyAnalysis; examId: string; studentId: string; attemptId: string;
  onChanged: () => Promise<void>;
}) {
  const targets = [
    { key: "SUMMARY", label: "Nhận định tổng quan", text: analysis.rawReport.summary },
    ...analysis.rawReport.weakAreas.flatMap(area => [
      { key: `AREA:${area.id}:DIAGNOSIS`, label: `${area.topicName} · Chẩn đoán`, text: area.diagnosis },
      { key: `AREA:${area.id}:REVIEW`, label: `${area.topicName} · Nội dung ôn`, text: area.reviewSummary },
    ]),
    ...analysis.rawPracticeQuestions.map(q => ({ key: `QUESTION:${q.id}`, label: `Câu luyện · ${q.topicName}`, text: q.content })),
  ];
  const [target, setTarget] = useState("SUMMARY");
  const [decision, setDecision] = useState<StudyAiReview["decision"]>("CONFIRMED");
  const [effectiveText, setEffectiveText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = targets.find(t => t.key === target) ?? targets[0];
  const prior = analysis.reviews.find(r => r.targetKey === target);
  async function save() {
    setBusy(true); setMessage("");
    try {
      await examService.reviewStudyAi(examId, studentId, attemptId, {
        targetKey: target, decision, effectiveText: decision === "EDITED" ? effectiveText : undefined,
        reason, expectedVersion: prior?.version ?? 0, expectedAnalysisVersion: analysis.version,
      });
      await onChanged(); setMessage("Đã lưu quyết định và lịch sử nhận định.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu quyết định"); }
    finally { setBusy(false); }
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-bold">Kiểm duyệt nhận định và câu luyện</summary>
    <div className="mt-3 space-y-3">
      <label className="block text-sm">Nội dung cần kiểm duyệt
        <Select className="mt-1 w-full rounded-lg border p-2" value={target} onChange={e => { setTarget(e.target.value); setEffectiveText(""); setMessage(""); }}>
          {targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
      </label>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{current.text}</p>
      <label className="block text-sm">Quyết định
        <Select className="mt-1 w-full rounded-lg border p-2" value={decision} onChange={e => setDecision(e.target.value as StudyAiReview["decision"])}>
          <option value="CONFIRMED">Xác nhận</option><option value="EDITED">Sửa nội dung</option><option value="REJECTED">Bác bỏ</option>
        </Select>
      </label>
      {decision === "EDITED" && <label className="block text-sm">Nội dung đã sửa<Textarea className="mt-1 w-full rounded-lg border p-2" maxLength={4000} value={effectiveText} onChange={e => setEffectiveText(e.target.value)} /></label>}
      <label className="block text-sm">Lý do quyết định<Textarea className="mt-1 w-full rounded-lg border p-2" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button disabled={busy || !reason.trim() || (decision === "EDITED" && !effectiveText.trim())} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu quyết định"}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
      <p className="text-xs text-slate-500">Kết quả luyện tập đã lưu giữ nguyên snapshot. Quyết định không tự sửa lịch sử bài làm.</p>
    </div>
  </details>;
}
