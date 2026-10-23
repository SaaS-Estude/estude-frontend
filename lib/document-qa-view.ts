import { ApiError } from "@/lib/auth-api";
import type { DocumentQaLimits, DocumentQaMessage } from "@/types/document-qa";

export const QA_LIMIT_CODE = "STUDY_QA_LIMIT";
export const QA_QUEUE_CODE = "AI_QUEUE_BUSY";
export const MAX_QUESTION_LENGTH = 1000;
export const MIN_QUESTION_LENGTH = 3;
/** Mirrors the server: a question this soon after the last answer continues that conversation. */
export const CONVERSATION_TTL_MS = 2 * 60 * 60 * 1000;
/** How many earlier questions the server uses to understand a follow-up. */
export const CONTEXT_TURNS = 3;

export type AnswerPart =
  | { kind: "text"; text: string }
  | { kind: "marker"; marker: number };

/**
 * Splits an answer into text and citation markers like "[2]". A marker is only
 * a citation when it points at one that exists; anything else stays plain text,
 * so a made-up "[9]" can never look like a source.
 */
export function answerParts(answer: string, citationCount: number): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const marker = Number(match[1]);
    if (marker < 1 || marker > citationCount) continue;
    const at = match.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: answer.slice(last, at) });
    parts.push({ kind: "marker", marker });
    last = at + match[0].length;
  }
  if (last < answer.length) parts.push({ kind: "text", text: answer.slice(last) });
  return parts;
}

/** The question as it will be sent, or why it cannot be. */
export function checkQuestion(raw: string): { ok: true; question: string } | { ok: false; reason: string } {
  const question = raw.trim();
  const length = [...question].length;
  if (length < MIN_QUESTION_LENGTH) return { ok: false, reason: "Hãy nhập câu hỏi dài hơn." };
  if (length > MAX_QUESTION_LENGTH) return { ok: false, reason: `Câu hỏi tối đa ${MAX_QUESTION_LENGTH} ký tự.` };
  return { ok: true, question };
}

export function resetLabel(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

export function limitSummary(limits: DocumentQaLimits | null): string {
  if (!limits) return "";
  if (limits.remaining > 0) return `Còn ${limits.remaining}/${limits.limit} lượt hỏi trong 24 giờ`;
  const reset = resetLabel(limits.resetsAt);
  return reset ? `Đã dùng hết ${limits.limit} lượt hỏi. Mở lại lúc ${reset}` : `Đã dùng hết ${limits.limit} lượt hỏi`;
}

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `qa-${crypto.randomUUID()}`;
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function qaErrorMessage(cause: unknown): { message: string; limitReached: boolean } {
  if (cause instanceof ApiError) {
    if (cause.code === QA_LIMIT_CODE) return { message: cause.message, limitReached: true };
    if (cause.status === 404) return { message: "Bạn không còn quyền hỏi về tài liệu này hoặc tài liệu đã bị gỡ.", limitReached: false };
    return { message: cause.message, limitReached: false };
  }
  return { message: cause instanceof Error ? cause.message : "Không thể gửi câu hỏi lúc này.", limitReached: false };
}

/** True at each index where a message starts a new conversation (never at 0). */
export function conversationBreaks(messages: DocumentQaMessage[]): boolean[] {
  return messages.map((m, i) => i > 0 && m.conversationId !== messages[i - 1].conversationId);
}

/** Whether the next question would continue the conversation of the last answer. */
export function continuesConversation(messages: DocumentQaMessage[], now = Date.now()): boolean {
  const last = messages[messages.length - 1];
  if (!last) return false;
  const at = Date.parse(last.createdAt);
  return Number.isFinite(at) && now - at < CONVERSATION_TTL_MS;
}

/** The one-line hint under the question box. */
export function conversationHint(messages: DocumentQaMessage[], startNew: boolean, now = Date.now()): string {
  if (!messages.length) return "";
  if (startNew) return "Câu hỏi tiếp theo sẽ bắt đầu chủ đề mới, không dựa trên các câu trước.";
  if (continuesConversation(messages, now)) return `Câu hỏi ngắn như "còn ví dụ thì sao?" sẽ được hiểu theo ${CONTEXT_TURNS} câu gần nhất trong chủ đề này.`;
  return "";
}
