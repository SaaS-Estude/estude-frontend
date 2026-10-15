import { examAttemptService } from "@/lib/assessment-api";
import { ApiError } from "@/lib/auth-api";
import type { StudyAnalysis } from "@/types/assessment";

export async function loadOrCreateStudentStudyAnalysis(
  attemptId: string,
  onCreating?: () => void,
): Promise<StudyAnalysis> {
  try {
    return await examAttemptService.getStudyAnalysis(attemptId);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
    onCreating?.();
    return examAttemptService.createStudyAnalysis(attemptId);
  }
}
