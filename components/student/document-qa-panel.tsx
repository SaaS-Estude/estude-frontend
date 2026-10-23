"use client";

import { LoaderCircle, MessageCircleQuestion, Quote, SearchX } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-control";
import { askWithQueueRetry, documentQaService } from "@/lib/document-qa-api";
import {
  MAX_QUESTION_LENGTH,
  answerParts,
  checkQuestion,
  continuesConversation,
  conversationBreaks,
  conversationHint,
  limitSummary,
  newRequestId,
  qaErrorMessage,
} from "@/lib/document-qa-view";
import type { DocumentQaKind, DocumentQaLimits, DocumentQaMessage } from "@/types/document-qa";

/**
 * Ask a question about one PDF. Every answer shows the passages of the document
 * it relies on, and "the document does not say" is a normal, honest result.
 */
export function DocumentQaPanel({ kind, documentId, sleep }: { kind: DocumentQaKind; documentId: string; sleep?: (ms: number) => Promise<void> }) {
  const [messages, setMessages] = useState<DocumentQaMessage[]>([]);
  const [limits, setLimits] = useState<DocumentQaLimits | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [queueNotice, setQueueNotice] = useState("");
  const [startNew, setStartNew] = useState(false);
  // One id per attempt at a question, kept across automatic retries so none is charged twice.
  const requestId = useRef("");
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const history = await documentQaService.history(kind, documentId);
      setMessages(history.messages);
      setLimits(history.limits);
    } catch (cause) {
      setError(qaErrorMessage(cause).message);
    } finally {
      setLoading(false);
    }
  }, [kind, documentId]);

  useEffect(() => { void load(); }, [load]);

  const exhausted = limits !== null && limits.remaining <= 0;
  const breaks = conversationBreaks(messages);
  const canStartNew = messages.length > 0 && continuesConversation(messages);

  async function submit() {
    if (lock.current || exhausted) return;
    const checked = checkQuestion(question);
    if (!checked.ok) { setError(checked.reason); return; }
    lock.current = true;
    setAsking(true);
    setError("");
    setQueueNotice("");
    if (!requestId.current) requestId.current = newRequestId();
    const id = requestId.current;
    try {
      const result = await askWithQueueRetry(() => documentQaService.ask(kind, documentId, checked.question, id, startNew), {
        onQueued: (notice) => setQueueNotice(notice.message),
        sleep,
      });
      setMessages((current) => [...current.filter((m) => m.id !== result.message.id), result.message]);
      setLimits(result.limits);
      setQuestion("");
      setStartNew(false);
      requestId.current = "";
    } catch (cause) {
      const { message, limitReached } = qaErrorMessage(cause);
      setError(message);
      // A refused or failed question is not charged, so the next try gets a fresh id.
      requestId.current = "";
      if (limitReached) void documentQaService.limits().then(setLimits).catch(() => undefined);
    } finally {
      lock.current = false;
      setAsking(false);
      setQueueNotice("");
    }
  }

  const length = [...question].length;
  return (
    <section aria-label="Hỏi đáp về tài liệu" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><MessageCircleQuestion className="size-5 text-brand-600" /> Hỏi đáp về tài liệu</h2>
          <p className="mt-1 text-sm text-slate-500">Câu trả lời chỉ dựa trên tài liệu này và luôn kèm đoạn trích để bạn tự kiểm tra.</p>
        </div>
        {limits ? <p role="status" className={`rounded-full px-3 py-1 text-xs font-bold ${exhausted ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-brand-700"}`}>{limitSummary(limits)}</p> : null}
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">Đang tải lịch sử hỏi đáp…</p> : null}
      <ol className="mt-4 space-y-4" aria-live="polite">
        {messages.map((message, index) => <li key={message.id} className="space-y-2">
          {breaks[index] ? <div role="separator" aria-label="Chủ đề mới" className="flex items-center gap-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-200" />Chủ đề mới<span className="h-px flex-1 bg-slate-200" /></div> : null}
          <p className="ml-auto max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white sm:max-w-[80%]">{message.question}</p>
          {message.status === "NOT_FOUND"
            ? <div className="flex max-w-[95%] gap-2 rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><SearchX className="mt-0.5 size-4 shrink-0" /><p>{message.answer} Hãy thử hỏi theo cách khác hoặc hỏi giáo viên.</p></div>
            : <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
              <p className="whitespace-pre-wrap break-words">{answerParts(message.answer, message.citations.length).map((part, i) => <Fragment key={i}>{part.kind === "text" ? part.text : <a href={`#qa-${message.id}-${part.marker}`} className="mx-0.5 inline-block rounded bg-brand-100 px-1.5 text-xs font-black text-brand-800 no-underline" aria-label={`Nguồn ${part.marker}`}>{part.marker}</a>}</Fragment>)}</p>
              <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3">{message.citations.map((c) => <li id={`qa-${message.id}-${c.marker}`} key={c.marker} className="flex gap-2 text-xs text-slate-600">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-brand-100 font-black text-brand-800">{c.marker}</span>
                <span><span className="font-bold text-slate-700">{c.documentName} · trang {c.page}</span><span className="mt-0.5 flex gap-1 italic"><Quote className="mt-0.5 size-3 shrink-0" />{c.excerpt}</span></span>
              </li>)}</ul>
            </div>}
        </li>)}
        {!loading && !messages.length ? <li className="text-sm text-slate-500">Chưa có câu hỏi nào. Hãy hỏi về một khái niệm, định nghĩa hay ví dụ trong tài liệu.</li> : null}
      </ol>

      {asking ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" /> Đang tìm câu trả lời trong tài liệu…</p> : null}
      {queueNotice ? <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{queueNotice} Trang sẽ tự thử lại, bạn không cần bấm thêm và không bị tính thêm lượt hỏi.</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}

      <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Textarea aria-label="Câu hỏi về tài liệu" value={question} maxLength={MAX_QUESTION_LENGTH} rows={3} disabled={asking || exhausted}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void submit(); } }}
          placeholder={exhausted ? "Bạn đã dùng hết lượt hỏi hôm nay." : "Ví dụ: Định nghĩa đạo hàm trong tài liệu là gì?"} />
        {conversationHint(messages, startNew) ? <p className="mt-2 text-xs text-slate-500">{conversationHint(messages, startNew)}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{length}/{MAX_QUESTION_LENGTH} · Ctrl+Enter để gửi</span>
          <div className="flex items-center gap-2">
            {canStartNew ? <Button type="button" variant="ghost" aria-pressed={startNew} disabled={asking || exhausted} onClick={() => setStartNew((current) => !current)}>{startNew ? "Tiếp tục chủ đề cũ" : "Chủ đề mới"}</Button> : null}
            <Button type="submit" disabled={asking || exhausted || length < 3}>{asking ? <LoaderCircle className="size-4 animate-spin" /> : <MessageCircleQuestion className="size-4" />} Hỏi</Button>
          </div>
        </div>
      </form>
    </section>
  );
}
