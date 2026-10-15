"use client";
import { assessmentPurposeLabels, type AssessmentPurpose } from "@/lib/internal-results";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { assignmentService } from "@/lib/assignment-api";
import { LearningExceptionForm } from "@/components/learning/learning-exception-form";
import {
  assignmentStateLabels,
  type Assignment,
  type AssignmentInput,
  type AssignmentRecipient,
  type AssignmentTerm,
  type SubmissionAttempt,
  type TeacherAssignmentDetail,
} from "@/types/assignment";

const field =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const labels = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đang mở",
  ARCHIVED: "Đã lưu trữ",
  HISTORY: "Lịch sử",
};
const localDate = (value: string | null) =>
  value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const displayDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Không giới hạn";
const empty: AssignmentInput = {
  title: "",
  termId: "",
  assessmentPurpose: "REGULAR" as AssessmentPurpose,
  description: "",
  instructions: "",
  maxScore: 10,
  requiredForCompletion: true,
  completionRule: "SUBMITTED",
  submissionType: "TEXT_AND_FILE",
  availableFrom: null,
  dueAt: null,
  cutoffAt: null,
  allowLateSubmission: false,
  allowResubmit: false,
  maxAttempts: 1,
};

export function TeacherAssignmentPanel({ lessonId }: { lessonId: string }) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [terms, setTerms] = useState<AssignmentTerm[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ row?: Assignment } | null>(null);
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [detail, setDetail] = useState<TeacherAssignmentDetail | null>(null);
  const [preview, setPreview] = useState<Assignment | null>(null);
  const [remove, setRemove] = useState<Assignment | null>(null);
  const [grading, setGrading] = useState<SubmissionAttempt | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [audit, setAudit] = useState<
    Array<{
      id: string;
      action: string;
      actorId: string;
      before: unknown;
      after: unknown;
      reason: string;
      createdAt: string;
    }>
  >([]);
  const [excuse, setExcuse] = useState<AssignmentRecipient | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await assignmentService.listTeacher(lessonId);
      setRows(data.assignments);
      setTerms(data.terms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải bài tập");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);
  useEffect(() => {
    setSelected("");
    setDetail(null);
    setEditor(null);
    void load();
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void assignmentService
      .teacherDetail(selected, filter)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Không thể tải bài nộp");
      });
    return () => {
      active = false;
    };
  }, [selected, filter]);
  async function run(work: () => Promise<unknown>, refreshSelected = true) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      if (selected && refreshSelected)
        setDetail(await assignmentService.teacherDetail(selected, filter));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật bài tập");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function edit(row?: Assignment) {
    setEditor({ row });
    setForm(
      row
        ? { ...empty, ...row, assessmentPurpose: row.assessmentPurpose ?? "LEGACY_REVIEW" }
        : {
            ...empty,
            termId:
              terms.find((t) => !["LOCKED", "COMPLETED"].includes(t.status))
                ?.id ?? "",
          },
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const payload: AssignmentInput = {
      title: form.title,
      termId: form.termId,
      assessmentPurpose: form.assessmentPurpose === "LEGACY_REVIEW" ? undefined : form.assessmentPurpose,
      description: form.description,
      instructions: form.instructions,
      maxScore: form.maxScore,
      requiredForCompletion: form.requiredForCompletion,
      completionRule: form.completionRule,
      passingScore: form.passingScore,
      submissionType: form.submissionType,
      availableFrom: form.availableFrom,
      dueAt: form.dueAt,
      cutoffAt: form.cutoffAt,
      allowLateSubmission: form.allowLateSubmission,
      allowResubmit: form.allowResubmit,
      maxAttempts: form.maxAttempts,
    };
    const okay = await run(() =>
      editor.row
        ? assignmentService.update(editor.row.id, {
            ...payload,
            revision: editor.row.revision,
          })
        : assignmentService.create(lessonId, payload),
    );
    if (okay) setEditor(null);
  }
  async function openGrade(attempt: SubmissionAttempt) {
    setBusy(true);
    setError("");
    try {
      const data = await assignmentService.teacherAttempt(attempt.id);
      setGrading(data.attempt);
      setAudit(data.audit);
      setScore(data.attempt.score === null ? "" : String(data.attempt.score));
      setFeedback(data.attempt.feedback);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể mở bài nộp");
    } finally {
      setBusy(false);
    }
  }
  async function openFile(id: string) {
    await run(async () => {
      const access = await assignmentService.fileAccess(id);
      window.open(access.url, "_blank", "noopener,noreferrer");
    });
  }
  return (
    <section className="mt-5 space-y-3 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold">Bài tập trong bài học</h4>
        <Button
          permission="teaching.create"
          size="sm"
          disabled={busy || !terms.length}
          onClick={() => edit()}
        >
          Tạo bài tập
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải bài tập...</p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500">Chưa có bài tập.</p>
      ) : (
        rows.map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-slate-200 p-3"
          >
            <button
              className="text-left font-semibold"
              onClick={() => {
                setSelected(row.id);
                setFilter("ALL");
              }}
            >
              {row.title}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              {row.status === "DRAFT" && row.publishedAt ? "Đã đóng" : labels[row.status]} · Hạn nộp: {displayDate(row.dueAt)} ·{" "}
              {row.submissionCount ?? 0}/{row.audienceCount ?? 0} học sinh đã
              nộp · {row.gradedCount ?? 0} đã chấm
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                permission="teaching.update"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => edit(row)}
              >
                Chỉnh sửa
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setPreview(
                      (await assignmentService.preview(row.id)).assignment,
                    ),
                  )
                }
              >
                Xem trước bài tập
              </Button>
              <Button
                permission="teaching.update"
                size="sm"
                disabled={busy}
                title={row.status === "PUBLISHED" ? "Đóng và ẩn bài tập, ngừng nhận bài mới; giữ lại bài nộp và lịch sử" : "Đăng bài tập cho học sinh theo thời gian đã đặt"}
                onClick={() =>
                  void run(() =>
                    assignmentService.lifecycle(
                      row.id,
                      row.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                      row.revision,
                    ),
                  )
                }
              >
                {row.status === "PUBLISHED"
                  ? "Đóng bài tập"
                  : "Tải lên"}
              </Button>
              {row.status !== "ARCHIVED" ? (
                <Button
                  permission="teaching.update"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      assignmentService.lifecycle(
                        row.id,
                        "ARCHIVED",
                        row.revision,
                      ),
                    )
                  }
                >
                  Lưu trữ bài tập
                </Button>
              ) : (
                <Button
                  permission="teaching.update"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      assignmentService.lifecycle(
                        row.id,
                        "DRAFT",
                        row.revision,
                      ),
                    )
                  }
                >
                  Khôi phục bản nháp
                </Button>
              )}
              {row.status === "DRAFT" && !row.publishedAt ? (
                <Button
                  permission="teaching.delete"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRemove(row)}
                >
                  Xóa bài tập nháp
                </Button>
              ) : null}
            </div>
          </article>
        ))
      )}
      {detail && selected ? (
        <div className="rounded-xl bg-slate-50 p-4">
          <h5 className="font-bold">Bài nộp: {detail.assignment.title}</h5>
          {detail.assignment.status === "PUBLISHED" && detail.classId ? <LearningExceptionForm key={detail.assignment.id} mode="assignment"
            sourceId={detail.assignment.id} classId={detail.classId} onSaved={() => { void load(); void assignmentService.teacherDetail(selected, filter).then(setDetail); }} /> : null}
          <p className="mt-1 text-xs text-slate-500">
            Đối tượng lúc công bố: {detail.summary.assigned} · Đúng hạn:{" "}
            {detail.summary.onTime} · Trễ: {detail.summary.late} · Chưa nộp:{" "}
            {detail.summary.notSubmitted} · Miễn: {detail.summary.excused} · Đã
            trả: {detail.summary.returned}
          </p>
          <select
            aria-label="Lọc bài nộp"
            className={`${field} mt-3`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["ALL", "Tất cả"],
              ["SUBMITTED", "Đã nộp"],
              ["LATE", "Nộp trễ"],
              ["NOT_SUBMITTED", "Chưa nộp"],
              ["UNGRADED", "Chưa chấm"],
              ["GRADED", "Đã chấm"],
              ["EXCUSED", "Được miễn"],
            ].map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <div className="mt-3 space-y-3">
            {detail.recipients.map((recipient) => (
              <article key={recipient.id} className="rounded-lg bg-white p-3">
                <p className="text-sm font-bold">
                  {recipient.studentName}{" "}
                  <span className="font-normal text-slate-500">
                    ({recipient.studentAccount})
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {assignmentStateLabels[recipient.state]}
                  {recipient.latest?.isLate
                    ? " · Nộp trễ"
                    : recipient.latest
                      ? " · Đúng hạn"
                      : ""}
                  {recipient.latest
                    ? ` · Lần ${recipient.latest.attemptNumber} · ${displayDate(recipient.latest.submittedAt)}`
                    : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recipient.latest ? (
                    <Button
                      permission="teaching.update"
                      size="sm"
                      disabled={busy || !!recipient.excusedAt}
                      onClick={() => void openGrade(recipient.latest!)}
                    >
                      Mở / chấm bài
                    </Button>
                  ) : null}
                  <Button
                    permission="teaching.update"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setExcuse(recipient);
                      setExcuseReason("");
                    }}
                  >
                    {recipient.excusedAt ? "Bỏ miễn" : "Miễn bài"}
                  </Button>
                </div>
                {recipient.attempts.length > 1 ? (
                  <details className="mt-2 text-xs">
                    <summary>
                      Lịch sử {recipient.attempts.length} lần nộp
                    </summary>
                    {recipient.attempts.map((attempt) => (
                      <button
                        key={attempt.id}
                        className="mt-2 block text-brand-600"
                        onClick={() => void openGrade(attempt)}
                      >
                        Lần {attempt.attemptNumber} ·{" "}
                        {displayDate(attempt.submittedAt)} ·{" "}
                        {attempt.isLate ? "Trễ" : "Đúng hạn"}
                      </button>
                    ))}
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <Modal
        open={editor !== null}
        title={editor?.row ? "Chỉnh sửa bài tập" : "Tạo bài tập (bản nháp)"}
        onClose={() => !busy && setEditor(null)}
        width="max-w-2xl"
        footer={
          <Button type="submit" form="assignment-editor" disabled={busy}>
            Lưu bài tập
          </Button>
        }
      >
        <form
          id="assignment-editor"
          onSubmit={(e) => void save(e)}
          className="grid gap-3"
        >
          <label className="grid gap-1 text-sm">
            Tên bài tập
            <input
              aria-label="Tên bài tập"
              className={field}
              required
              minLength={2}
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">Mục đích bài tập<select className={field} aria-label="Mục đích bài tập" value={form.assessmentPurpose} disabled={!!editor?.row?.publishedAt} onChange={(e) => setForm({ ...form, assessmentPurpose: e.target.value as AssessmentPurpose })}>{Object.entries(assessmentPurposeLabels).filter(([id]) => id !== 'LEGACY_REVIEW' || form.assessmentPurpose === id).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm">
            Học kỳ
            <select
              aria-label="Học kỳ bài tập"
              className={field}
              required
              disabled={!!editor?.row?.publishedAt}
              value={form.termId}
              onChange={(e) => setForm({ ...form, termId: e.target.value })}
            >
              <option value="">Chọn học kỳ</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.status}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Mô tả
            <textarea
              className={field}
              maxLength={2000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            Yêu cầu / hướng dẫn
            <textarea
              aria-label="Hướng dẫn bài tập"
              className={`${field} min-h-28`}
              maxLength={50000}
              value={form.instructions}
              onChange={(e) =>
                setForm({ ...form, instructions: e.target.value })
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Điểm tối đa
              <input
                aria-label="Điểm tối đa"
                className={field}
                type="number"
                min="0.01"
                max="10000"
                step="any"
                required
                disabled={!!editor?.row?.publishedAt}
                value={form.maxScore}
                onChange={(e) =>
                  setForm({ ...form, maxScore: Number(e.target.value) })
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Loại bài nộp
              <select
                className={field}
                disabled={!!editor?.row?.publishedAt}
                value={form.submissionType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    submissionType: e.target
                      .value as AssignmentInput["submissionType"],
                  })
                }
              >
                <option value="TEXT">Văn bản</option>
                <option value="FILE">File</option>
                <option value="TEXT_AND_FILE">Văn bản và/hoặc file</option>
              </select>
            </label>
          </div>
          {(
            [
              ["availableFrom", "Mở nhận bài"],
              ["dueAt", "Hạn nộp đúng giờ"],
              ["cutoffAt", "Khóa nhận bài"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                aria-label={label}
                className={field}
                type="datetime-local"
                value={localDate(form[key])}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
              />
            </label>
          ))}
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={form.requiredForCompletion !== false} onChange={(e) => setForm({ ...form, requiredForCompletion: e.target.checked })} />
            Bắt buộc để hoàn thành bài học
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowLateSubmission}
              onChange={(e) =>
                setForm({ ...form, allowLateSubmission: e.target.checked })
              }
            />
            Cho phép nộp trễ trước khóa nhận bài
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!!editor?.row?.publishedAt}
              checked={form.allowResubmit}
              onChange={(e) =>
                setForm({ ...form, allowResubmit: e.target.checked })
              }
            />
            Cho phép nộp lại
          </label>
          <label className="grid gap-1 text-sm">
            Số lần nộp tối đa (để trống = không giới hạn)
            <input
              className={field}
              type="number"
              min="1"
              max="1000"
              disabled={!!editor?.row?.publishedAt}
              value={form.maxAttempts ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxAttempts: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
          <p className="text-xs text-slate-500">
            Giờ server quyết định đúng hạn/trễ. Công bố không tự công bố
            Topic/Lesson. Danh sách người nhận được cố định lúc công bố lần đầu;
            điểm không tự chuyển vào sổ điểm.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>
      <Modal
        open={preview !== null}
        title="Xem trước bài tập — không công bố"
        onClose={() => setPreview(null)}
      >
        {preview ? (
          <div className="space-y-3">
            <h4 className="font-bold">{preview.title}</h4>
            <p className="whitespace-pre-wrap text-sm">{preview.description}</p>
            <p className="whitespace-pre-wrap text-sm">
              {preview.instructions}
            </p>
            <p className="text-sm">
              Điểm tối đa: {preview.maxScore} · Hạn nộp:{" "}
              {displayDate(preview.dueAt)}
            </p>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={grading !== null}
        title={`Chấm lần nộp ${grading?.attemptNumber ?? ""}`}
        onClose={() => !busy && setGrading(null)}
        width="max-w-3xl"
      >
        {grading ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {displayDate(grading.submittedAt)} ·{" "}
              {grading.isLate ? "Nộp trễ" : "Đúng hạn"}
            </p>
            <details className="text-xs text-slate-500">
              <summary>Yêu cầu tại thời điểm nộp</summary>
              <p className="mt-2 whitespace-pre-wrap">
                {grading.assignmentSnapshot.instructions}
              </p>
            </details>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
              {grading.textContent || "Bài nộp bằng file"}
            </p>
            {grading.files.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void openFile(f.id)}
              >
                {f.originalName}
              </Button>
            ))}
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const saved = await assignmentService.grade(
                    grading.id,
                    Number(score),
                    feedback,
                    grading.revision ?? 0,
                    reason,
                  );
                  setGrading(saved);
                  const refreshed = await assignmentService.teacherAttempt(
                    saved.id,
                  );
                  setAudit(refreshed.audit);
                });
              }}
            >
              <label className="grid gap-1 text-sm">
                Điểm / {grading.maxScore}
                <input
                  aria-label="Điểm bài nộp"
                  className={field}
                  type="number"
                  step="any"
                  min="0"
                  max={grading.maxScore}
                  required
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Feedback
                <textarea
                  aria-label="Feedback bài nộp"
                  className={field}
                  maxLength={10000}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Lý do sửa điểm
                <input
                  aria-label="Lý do sửa điểm"
                  className={field}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  permission="teaching.update"
                  type="submit"
                  disabled={busy}
                >
                  Lưu điểm nháp
                </Button>
                <Button
                  permission="teaching.update"
                  variant="outline"
                  disabled={
                    busy ||
                    grading.status !== "GRADED_DRAFT" ||
                    score.trim() === "" ||
                    Number(score) !== grading.score ||
                    feedback !== grading.feedback
                  }
                  onClick={() =>
                    void run(async () => {
                      const returned = await assignmentService.returnGrade(
                        grading.id,
                        grading.revision ?? 0,
                      );
                      setGrading(returned);
                      const refreshed = await assignmentService.teacherAttempt(
                        returned.id,
                      );
                      setAudit(refreshed.audit);
                    })
                  }
                >
                  Trả kết quả
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Học sinh chỉ thấy điểm đã trả. Sửa điểm nháp không thay thế kết
                quả cũ cho đến khi trả lại.
              </p>
              {error ? (
                <p role="alert" className="text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
            </form>
            <details className="text-xs text-slate-500">
              <summary>Lịch sử chấm điểm ({audit.length})</summary>
              {audit.map((entry) => (
                <p key={entry.id} className="mt-2 break-words">
                  {displayDate(entry.createdAt)} · {entry.action} ·{" "}
                  {entry.actorId} · {JSON.stringify(entry.before)} →{" "}
                  {JSON.stringify(entry.after)} {entry.reason}
                </p>
              ))}
            </details>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={excuse !== null}
        title={excuse?.excusedAt ? "Bỏ miễn bài tập" : "Miễn bài tập"}
        onClose={() => !busy && setExcuse(null)}
      >
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!excuse || !detail) return;
            void run(async () => {
              await assignmentService.excuse(
                detail.assignment.id,
                excuse.studentId,
                !excuse.excusedAt,
                excuseReason,
                excuse.revision,
              );
              setExcuse(null);
            });
          }}
        >
          <p className="text-sm">
            {excuse?.studentName}. Lịch sử nộp/chấm vẫn được giữ.
          </p>
          <input
            aria-label="Lý do miễn bài"
            className={field}
            required
            minLength={2}
            maxLength={1000}
            value={excuseReason}
            onChange={(e) => setExcuseReason(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            Xác nhận miễn / bỏ miễn
          </Button>
        </form>
      </Modal>
      <ConfirmationDialog
        open={remove !== null}
        title="Xóa bài tập nháp"
        confirmLabel="Xóa bản nháp"
        loading={busy}
        onClose={() => setRemove(null)}
        onConfirm={() =>
          void run(async () => {
            if (remove) {
              await assignmentService.remove(remove.id);
              if (selected === remove.id) {
                setSelected("");
                setDetail(null);
              }
              setRemove(null);
            }
          }, false)
        }
      >
        Chỉ xóa bản nháp chưa từng công bố và chưa có bài nộp.
      </ConfirmationDialog>
    </section>
  );
}
