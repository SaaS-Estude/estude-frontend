"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { examService } from "@/lib/assessment-api";
import type { TeacherStudyAnalysis } from "@/types/assessment";

export function StudyTopicSuggestionsPanel({
  analysis,
  examId,
  studentId,
  attemptId,
  onChanged,
}: {
  analysis: TeacherStudyAnalysis;
  examId: string;
  studentId: string;
  attemptId: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [reviewOverrides, setReviewOverrides] = useState<
    Record<string, TeacherStudyAnalysis["reviews"][number]>
  >({});
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [rejectingQuestionId, setRejectingQuestionId] = useState("");
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>(
    {},
  );
  const automaticAttempt = useRef("");
  const suggestions = analysis.report.topicSuggestions ?? [];
  const pendingSuggestions = suggestions.filter((suggestion) => {
    const targetKey = `TOPIC:${suggestion.questionId}`;
    return !(
      analysis.reviews.some((item) => item.targetKey === targetKey) ||
      reviewOverrides[targetKey]
    );
  });
  const needsSuggestions = analysis.rawReport.topicPerformance.some(
    (topic) =>
      topic.topicName === "Kiến thức tổng hợp" && topic.totalQuestions > 0,
  );
  async function run(
    targetKey: string,
    action: () => Promise<TeacherStudyAnalysis["reviews"][number]>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const review = await action();
      setReviewOverrides((current) => ({ ...current, [targetKey]: review }));
      setActiveQuestionId("");
      setRejectingQuestionId("");
      setMessage(success);
      void onChanged().catch(() => {
        // The decision is already saved and shown locally; a later reload will
        // reconcile the rest of the derived analysis if this refresh fails.
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể cập nhật chủ đề",
      );
    } finally {
      setBusy(false);
    }
  }

  const suggestTopics = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await examService.suggestStudyTopics(
        examId,
        studentId,
        attemptId,
      );
      if (!result.report.topicSuggestions?.length)
        throw new Error(
          "Chưa tìm được chủ đề có đủ căn cứ trong tài liệu. Hãy bổ sung tài liệu phù hợp hoặc kiểm tra chủ đề của câu hỏi.",
        );
      await onChanged();
      setMessage(
        "Đã tìm chủ đề đề xuất. Hãy kiểm tra nguồn và xác nhận từng câu.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể đề xuất chủ đề",
      );
    } finally {
      setBusy(false);
    }
  }, [attemptId, examId, onChanged, studentId]);

  useEffect(() => {
    if (
      !needsSuggestions ||
      suggestions.length ||
      automaticAttempt.current === attemptId
    )
      return;
    automaticAttempt.current = attemptId;
    void suggestTopics();
  }, [attemptId, needsSuggestions, suggestTopics, suggestions.length]);
  return (
    <section className="rounded-xl border border-blue-200 p-4">
      <h3 className="font-black">Xác nhận chủ đề cho câu hỏi còn thiếu</h3>
      <p className="mt-1 text-sm text-slate-600">
        Đây là bước xử lý dữ liệu còn thiếu. Giáo viên kiểm tra nguồn và xác
        nhận chủ đề; các chủ đề đã xử lý sẽ chỉ còn xuất hiện trong kết quả và
        nội dung ôn tập. Điểm bài làm được giữ nguyên.
      </p>
      {needsSuggestions && !suggestions.length && busy ? (
        <p
          role="status"
          className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700"
        >
          Đang tự động đối chiếu các câu hỏi với tài liệu môn học để đề xuất chủ
          đề…
        </p>
      ) : null}
      <Button
        className="mt-3"
        variant="outline"
        disabled={busy}
        onClick={() => void suggestTopics()}
      >
        {busy ? "Đang xử lý…" : "Đề xuất chủ đề từ tài liệu"}
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {!pendingSuggestions.length && suggestions.length ? (
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Đã xử lý xong các chủ đề được đề xuất.
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {pendingSuggestions.map((suggestion) => {
          const targetKey = `TOPIC:${suggestion.questionId}`;
          const review =
            analysis.reviews.find((item) => item.targetKey === targetKey) ??
            reviewOverrides[targetKey];
          let savedName = suggestion.topicName;
          if (review?.effectiveText) {
            try {
              savedName =
                JSON.parse(review.effectiveText).topicName || savedName;
            } catch {
              /* Older review text remains readable. */
            }
          }
          const name = names[suggestion.questionId] ?? savedName;
          const handled = Boolean(review);
          const isActive = activeQuestionId === suggestion.questionId;
          const isRejecting = rejectingQuestionId === suggestion.questionId;
          const rejectionNote = rejectionNotes[suggestion.questionId] ?? "";
          return (
            <article
              key={suggestion.questionId}
              className="rounded-lg bg-slate-50 p-4"
            >
              <p className="text-sm font-bold">
                Câu {suggestion.order + 1}: {suggestion.content}
              </p>
              {suggestion.sourceReferences.map((source) => (
                <blockquote
                  key={`${source.materialId}-${source.page}`}
                  className="mt-2 border-l-2 border-blue-300 pl-3 text-sm text-slate-600"
                >
                  <p className="font-semibold">
                    {source.documentName} · trang {source.page}
                  </p>
                  <p className="mt-1">{source.excerpt}</p>
                </blockquote>
              ))}
              <label className="mt-3 block text-sm font-semibold">
                Chủ đề đề xuất — có thể sửa tên trước khi xác nhận
                <input
                  className="mt-1 w-full rounded-lg border p-2 disabled:bg-slate-100 disabled:text-slate-600"
                  maxLength={160}
                  value={name}
                  disabled={busy || handled}
                  onChange={(event) =>
                    setNames((current) => ({
                      ...current,
                      [suggestion.questionId]: event.target.value,
                    }))
                  }
                />
              </label>
              <p
                className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${review?.decision === "REJECTED" ? "bg-rose-50 text-rose-700" : review ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                {review?.decision === "REJECTED"
                  ? `Đã bác bỏ · Nhận xét: ${review.reason}`
                  : review
                    ? `Đã xác nhận và dùng để nhóm kết quả: ${savedName}`
                    : "Chưa xác nhận — chưa dùng để nhóm kết quả"}
              </p>
              {!handled && !isActive ? (
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setActiveQuestionId(suggestion.questionId)}
                >
                  Xử lý đề xuất
                </Button>
              ) : null}
              {!handled && isActive ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-800">
                    Chọn cách xử lý
                  </p>
                  {isRejecting ? (
                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Nhận xét khi bác bỏ{" "}
                      <span className="text-rose-600">*</span>
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-lg border p-2 font-normal"
                        maxLength={2000}
                        value={rejectionNote}
                        disabled={busy}
                        placeholder="Nêu lý do chủ đề chưa phù hợp để lần sau giáo viên dễ đối chiếu"
                        onChange={(event) =>
                          setRejectionNotes((current) => ({
                            ...current,
                            [suggestion.questionId]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isRejecting ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy || !name.trim()}
                          onClick={() =>
                            void run(
                              targetKey,
                              () =>
                                examService.reviewStudyAi(
                                  examId,
                                  studentId,
                                  attemptId,
                                  {
                                    targetKey,
                                    decision:
                                      name.trim() === suggestion.topicName
                                        ? "CONFIRMED"
                                        : "EDITED",
                                    effectiveText: name.trim(),
                                    reason:
                                      "Giáo viên đã đối chiếu câu hỏi với tài liệu nguồn và xác nhận chủ đề",
                                    expectedVersion: 0,
                                  },
                                ),
                              "Đã xác nhận chủ đề và cập nhật nhóm kết quả.",
                            )
                          }
                        >
                          Dùng chủ đề này
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setRejectingQuestionId(suggestion.questionId)
                          }
                        >
                          Bác bỏ đề xuất
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy || rejectionNote.trim().length < 3}
                        onClick={() =>
                          void run(
                            targetKey,
                            () =>
                              examService.reviewStudyAi(
                                examId,
                                studentId,
                                attemptId,
                                {
                                  targetKey,
                                  decision: "REJECTED",
                                  reason: rejectionNote.trim(),
                                  expectedVersion: 0,
                                },
                              ),
                            "Đã bác bỏ đề xuất và lưu nhận xét của giáo viên.",
                          )
                        }
                      >
                        Xác nhận bác bỏ
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setActiveQuestionId("");
                        setRejectingQuestionId("");
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
