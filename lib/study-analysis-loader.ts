import { examAttemptService } from "@/lib/assessment-api";
import { ApiError } from "@/lib/auth-api";
import type { StudyAnalysis } from "@/types/assessment";

/** The school's AI line was full; the server kept our place and told us when to ask again. */
export const AI_QUEUE_BUSY = "AI_QUEUE_BUSY";

export interface QueueNotice {
  message: string;
  waitSeconds: number;
  attempt: number;
}

export interface LoaderOptions {
  /** How many times to ask again while the AI line is full. */
  maxQueueRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Seconds to wait before asking again, kept within a range that is neither spammy nor stuck. */
export function queueWaitSeconds(error: ApiError): number {
  return Math.min(60, Math.max(3, error.retryAfterSeconds ?? 10));
}

export async function loadOrCreateStudentStudyAnalysis(
  attemptId: string,
  onCreating?: () => void,
  onQueued?: (notice: QueueNotice) => void,
  options: LoaderOptions = {},
): Promise<StudyAnalysis> {
  try {
    return await examAttemptService.getStudyAnalysis(attemptId);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
  }
  onCreating?.();
  const maxRetries = options.maxQueueRetries ?? 8;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await examAttemptService.createStudyAnalysis(attemptId);
    } catch (cause) {
      const queued = cause instanceof ApiError && cause.status === 429 && cause.code === AI_QUEUE_BUSY;
      if (!queued || attempt >= maxRetries) throw cause;
      const waitSeconds = queueWaitSeconds(cause);
      onQueued?.({ message: cause.message, waitSeconds, attempt: attempt + 1 });
      await sleep(waitSeconds * 1000);
    }
  }
}
