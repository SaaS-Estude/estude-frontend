import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import type { DocumentQaHistory, DocumentQaKind, DocumentQaLimits, DocumentQaResult } from "@/types/document-qa";
import { QA_QUEUE_CODE } from "@/lib/document-qa-view";

export const documentQaService = {
  limits: () => authenticatedRequest<DocumentQaLimits>("/study-qa/limits", { cache: "no-store" }),
  history: (kind: DocumentQaKind, id: string) =>
    authenticatedRequest<DocumentQaHistory>(`/study-qa/documents/${kind}/${encodeURIComponent(id)}/messages`, { cache: "no-store" }),
  ask: (kind: DocumentQaKind, id: string, question: string, clientRequestId: string, newConversation = false) =>
    authenticatedRequest<DocumentQaResult>(`/study-qa/documents/${kind}/${encodeURIComponent(id)}/ask`, {
      method: "POST",
      body: JSON.stringify({ question, clientRequestId, newConversation }),
    }),
};

export interface AskRetryOptions {
  maxQueueRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onQueued?: (notice: { message: string; waitSeconds: number; attempt: number }) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Asks, and when the school's AI line is full waits and asks again with the
 * SAME request id. The server stores the answer by that id and gives a failed
 * attempt back, so a retry can never spend a second question.
 */
export async function askWithQueueRetry(
  ask: () => Promise<DocumentQaResult>,
  options: AskRetryOptions = {},
): Promise<DocumentQaResult> {
  const max = options.maxQueueRetries ?? 6;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await ask();
    } catch (cause) {
      const queued = cause instanceof ApiError && cause.status === 429 && cause.code === QA_QUEUE_CODE;
      if (!queued || attempt >= max) throw cause;
      const waitSeconds = Math.min(60, Math.max(3, cause.retryAfterSeconds ?? 10));
      options.onQueued?.({ message: cause.message, waitSeconds, attempt: attempt + 1 });
      await sleep(waitSeconds * 1000);
    }
  }
}
