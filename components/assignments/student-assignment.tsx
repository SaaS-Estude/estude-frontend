"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  assignmentService,
  clearSubmissionKey,
  submissionKey,
} from "@/lib/assignment-api";
import { ApiError } from "@/lib/auth-api";
import {
  assignmentStateLabels,
  type StudentAssignmentDetail,
  type SubmissionFile,
} from "@/types/assignment";

const displayDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Không giới hạn";

export function StudentAssignmentList({ lessonId }: { lessonId?: string }) {
  const [history, setHistory] = useState(false);
  const [rows, setRows] = useState<StudentAssignmentDetail[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void assignmentService
      .listStudent(lessonId, history)
      .then((data) => {
        if (active) setRows(data.assignments);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Không thể tải bài tập");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lessonId, history]);
  return (
    <section className="space-y-3">
      {!lessonId ? (
        <div className="flex gap-2">
          <Button
            variant={!history ? "primary" : "outline"}
            onClick={() => setHistory(false)}
          >
            Bài tập đang hoạt động
          </Button>
          <Button
            variant={history ? "primary" : "outline"}
            onClick={() => setHistory(true)}
          >
            Lịch sử bài tập
          </Button>
        </div>
      ) : null}
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
      ) : (
        rows.map((row) => (
          <article
            key={row.assignment.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <Link
              className="font-bold text-brand-700 hover:underline"
              href={`/student/assignments/${row.assignment.id}`}
            >
              {row.assignment.title}
            </Link>
            <p className="mt-2 text-sm text-slate-500">
              {assignmentStateLabels[row.state]} · Điểm tối đa:{" "}
              {row.assignment.maxScore} · Hạn nộp:{" "}
              {displayDate(row.assignment.dueAt)}
            </p>
            {row.attempts[0] ? (
              <p className="mt-1 text-xs text-slate-500">
                Lần {row.attempts[0].attemptNumber} ·{" "}
                {row.attempts[0].isLate ? "Nộp trễ" : "Đúng hạn"}
                {row.attempts[0].score !== null
                  ? ` · Điểm đã trả: ${row.attempts[0].score}/${row.attempts[0].maxScore}`
                  : ""}
              </p>
            ) : null}
          </article>
        ))
      )}
      {!loading && !error && !rows.length ? (
        <p className="text-sm text-slate-500">
          Chưa có bài tập {history ? "trong lịch sử" : "được phép truy cập"}.
        </p>
      ) : null}
    </section>
  );
}

export function StudentAssignmentDetail({ id }: { id: string }) {
  const [data, setData] = useState<StudentAssignmentDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [textContent, setTextContent] = useState("");
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [message, setMessage] = useState("");
  const pending = useRef<{ payload: string; key: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let result: StudentAssignmentDetail;
      try {
        result = await assignmentService.studentDetail(id);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 404) throw e;
        result = await assignmentService.studentDetail(id, true);
      }
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải bài tập");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    setData(null);
    setTextContent("");
    setFiles([]);
    pending.current = null;
    void load();
  }, [load]);
  async function upload(list: FileList | null) {
    if (!list?.length || busyRef.current) return;
    if (
      files.length + list.length > 5 ||
      Array.from(list).some((file) => file.size > 10 * 1024 * 1024) ||
      files.reduce((sum, file) => sum + file.size, 0) +
        Array.from(list).reduce((sum, file) => sum + file.size, 0) >
        25 * 1024 * 1024
    ) {
      setError("Tối đa 5 file, 10 MB/file và tổng 25 MB");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(list)) {
        const ready = await assignmentService.upload(id, file);
        setFiles((current) => [...current, ready]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể upload bài nộp");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !data?.canSubmit) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fileIds = files.map((file) => file.id);
      const payload = JSON.stringify({
        textContent: textContent.trim(),
        fileIds: [...fileIds].sort(),
      });
      const key =
        pending.current?.payload === payload
          ? pending.current.key
          : await submissionKey(id, textContent, fileIds);
      pending.current = { payload, key };
      const attempt = await assignmentService.submit(id, {
        textContent,
        fileIds,
        idempotencyKey: key,
      });
      clearSubmissionKey(id);
      pending.current = null;
      setTextContent("");
      setFiles([]);
      setMessage(
        `Đã nộp lần ${attempt.attemptNumber}: ${attempt.isLate ? "Nộp trễ" : "Đúng hạn"} (${displayDate(attempt.submittedAt)}).`,
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không thể nộp bài. Có thể gửi lại cùng nội dung để kiểm tra lần nộp.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function openFile(id: string) {
    setError("");
    try {
      const access = await assignmentService.fileAccess(id);
      window.open(access.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không có quyền mở file");
    }
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          className="text-sm font-semibold text-brand-600"
          href="/student/assignments"
        >
          ← Bài tập của tôi
        </Link>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>
          Làm mới bài tập
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
      {message ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải bài tập...</p>
      ) : data ? (
        <>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h1 className="text-xl font-bold">{data.assignment.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {data.assignment.description}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {data.assignment.instructions}
            </p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>Điểm tối đa: {data.assignment.maxScore}</p>
              <p>Trạng thái: {assignmentStateLabels[data.state]}</p>
              <p>Mở nhận bài: {displayDate(data.assignment.availableFrom)}</p>
              <p>Hạn đúng giờ: {displayDate(data.assignment.dueAt)}</p>
              <p>Khóa nhận bài: {displayDate(data.assignment.cutoffAt)}</p>
              <p>
                Nộp lại:{" "}
                {data.assignment.allowResubmit
                  ? `Có · tối đa ${data.assignment.maxAttempts ?? "không giới hạn"}`
                  : "Không"}
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Giờ server khi tải: {displayDate(data.serverNow)}. Thời điểm xác
              nhận nộp trên server quyết định đúng hạn/trễ; bắt đầu upload không
              giữ chỗ trước hạn.
            </p>
            {data.historyOnly ? (
              <p className="mt-3 text-sm text-amber-700">
                Chỉ xem lịch sử. Bài nộp và kết quả cũ vẫn được giữ sau khi
                chuyển lớp hoặc lưu trữ nội dung.
              </p>
            ) : null}
            {data.window === "NOT_OPEN" && !data.historyOnly ? (
              <p className="mt-3 text-sm text-amber-700">
                Bài tập đã được công bố nhưng chưa mở. Nội dung hướng dẫn và nộp bài sẽ khả dụng từ thời điểm mở nhận bài.
              </p>
            ) : null}
            {data.recipient.excusedAt ? (
              <p className="mt-3 text-sm text-emerald-700">
                Được miễn: {data.recipient.excuseReason}. Không bị xem là thiếu
                bài hoặc điểm 0.
              </p>
            ) : null}
          </article>
          {data.canSubmit ? (
            <form
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
              onSubmit={(e) => void submit(e)}
            >
              <h2 className="font-bold">
                {data.attempts.length
                  ? "Nộp lại — tạo lần nộp mới, giữ lịch sử"
                  : "Nộp bài"}
              </h2>
              {data.assignment.submissionType !== "FILE" ? (
                <label className="grid gap-2 text-sm">
                  Nội dung bài làm
                  <textarea
                    aria-label="Nội dung bài làm"
                    className="min-h-40 rounded-lg border border-slate-200 p-3"
                    maxLength={50000}
                    disabled={busy}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                </label>
              ) : null}
              {data.assignment.submissionType !== "TEXT" ? (
                <label className="grid gap-2 text-sm">
                  File bài làm (5 file, 10 MB/file, tổng 25 MB)
                  <input
                    aria-label="File bài làm"
                    type="file"
                    multiple
                    disabled={busy}
                    onChange={(e) => {
                      void upload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>{file.originalName} · Đã xác nhận upload</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item.id !== file.id),
                      )
                    }
                  >
                    Bỏ file
                  </Button>
                </div>
              ))}
              <Button
                permission="learning.submit"
                type="submit"
                disabled={busy || (!textContent.trim() && !files.length)}
              >
                {busy ? "Đang xử lý..." : "Xác nhận nộp bài"}
              </Button>
              {data.window === "LATE" ? (
                <p className="text-sm text-amber-700">
                  Bài nộp mới sẽ được đánh dấu trễ.
                </p>
              ) : null}
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              Không thể nộp mới ở trạng thái hiện tại. Không có bài nộp hoặc
              chưa chấm không đồng nghĩa với điểm 0.
            </p>
          )}
          <section className="space-y-3">
            <h2 className="font-bold">Lịch sử lần nộp và kết quả</h2>
            {!data.attempts.length ? (
              <p className="text-sm text-slate-500">
                Chưa có lần nộp. Điểm: chưa xác định.
              </p>
            ) : (
              data.attempts.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <h3 className="font-semibold">
                    Lần {attempt.attemptNumber} ·{" "}
                    {attempt.isLate ? "Nộp trễ" : "Đúng hạn"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Nộp lúc: {displayDate(attempt.submittedAt)} ·{" "}
                    {assignmentStateLabels[attempt.status]}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {attempt.textContent}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attempt.files.map((file) => (
                      <Button
                        key={file.id}
                        variant="outline"
                        size="sm"
                        onClick={() => void openFile(file.id)}
                      >
                        {file.originalName}
                      </Button>
                    ))}
                  </div>
                  {attempt.score !== null ? (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-3">
                      <p className="font-bold text-emerald-800">
                        Điểm đã trả: {attempt.score}/{attempt.maxScore}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {attempt.feedback}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Chưa có kết quả được công bố.
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
