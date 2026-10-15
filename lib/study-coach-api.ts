import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import type {
  FlashcardQueue,
  FlashcardReviewResult,
  StudyCoachFlashcard,
  StudyCoachQuizAnswerResult,
  StudyCoachQuizExport,
  StudyCoachQuizHistoryItem,
  StudyCoachQuizResult,
  StudyCoachQuizState,
  StudyCoachQuizSummary,
  ConceptMasteryState,
  ConceptMasteryResult,
  ConceptMasteryView,
  InsightScope,
  LearningInsight,
  StudyCoachCapabilities,
  StudyCoachGenerationJob,
  StudyCoachKnowledgeMap,
  StudyCoachMaterial,
  StudyCoachMaterialPage,
  StudyCoachUploadSession,
} from "@/types/study-coach";

export function uploadToAuthorizedUrl(
  session: Pick<StudyCoachUploadSession, "uploadUrl" | "method">,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(session.method, session.uploadUrl);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new ApiError(
        xhr.status === 403
          ? "Phiên tải lên đã hết hạn. Vui lòng bắt đầu lại."
          : "Không thể tải tệp lên kho lưu trữ.",
        xhr.status,
      ));
    });
    const rejectNetwork = () => reject(new ApiError("Không thể tải tệp lên. Hãy kiểm tra kết nối mạng.", 0));
    xhr.addEventListener("error", rejectNetwork);
    xhr.addEventListener("timeout", rejectNetwork);
    xhr.addEventListener("abort", rejectNetwork);
    xhr.send(file);
  });
}

export const studyCoachService = {
  getCapabilities(): Promise<StudyCoachCapabilities> {
    return authenticatedRequest("/study-coach/capabilities");
  },

  getMaterials(page = 1, limit = 6): Promise<StudyCoachMaterialPage> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return authenticatedRequest(`/study-coach/materials?${params.toString()}`);
  },

  getMaterial(materialId: string): Promise<StudyCoachMaterial> {
    return authenticatedRequest(`/study-coach/materials/${encodeURIComponent(materialId)}`);
  },

  getKnowledgeMap(materialId: string): Promise<StudyCoachKnowledgeMap> {
    return authenticatedRequest(
      `/study-coach/materials/${encodeURIComponent(materialId)}/knowledge-map`,
    );
  },

  createMaterialUpload(input: {
    fileName: string;
    contentType: string;
    fileSize: number;
    subjectId: string;
  }): Promise<StudyCoachUploadSession> {
    return authenticatedRequest("/study-coach/materials/upload-url", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  confirmMaterialUpload(materialId: string): Promise<StudyCoachUploadSession["material"]> {
    return authenticatedRequest(
      `/study-coach/materials/${encodeURIComponent(materialId)}/confirm`,
      { method: "POST" },
    );
  },

  processMaterial(materialId: string): Promise<StudyCoachGenerationJob> {
    return authenticatedRequest(
      `/study-coach/materials/${encodeURIComponent(materialId)}/process`,
      { method: "POST" },
    );
  },

  cancelMaterial(materialId: string): Promise<StudyCoachGenerationJob> {
    return authenticatedRequest(
      `/study-coach/materials/${encodeURIComponent(materialId)}/cancel`,
      { method: "POST" },
    );
  },

  deleteMaterial(materialId: string): Promise<{ id: string }> {
    return authenticatedRequest(
      `/study-coach/materials/${encodeURIComponent(materialId)}`,
      { method: "DELETE" },
    );
  },

  uploadAuthorizedFile: uploadToAuthorizedUrl,

  getFlashcards(filters: {
    documentId?: string;
    conceptId?: string;
    due?: boolean;
    limit?: number;
  } = {}): Promise<{ items: StudyCoachFlashcard[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.documentId) params.set("documentId", filters.documentId);
    if (filters.conceptId) params.set("conceptId", filters.conceptId);
    if (filters.due !== undefined) params.set("due", String(filters.due));
    if (filters.limit) params.set("limit", String(filters.limit));
    const query = params.toString();
    return authenticatedRequest(`/study-coach/flashcards${query ? `?${query}` : ""}`);
  },

  getDueQueue(documentId?: string, mode: "DUE" | "ALL" = "DUE"): Promise<FlashcardQueue> {
    const params = new URLSearchParams();
    if (documentId) params.set("documentId", documentId);
    if (mode === "ALL") params.set("mode", mode);
    const query = params.toString();
    return authenticatedRequest(`/study-coach/flashcards/due${query ? `?${query}` : ""}`, {
      cache: "no-store",
    });
  },

  getFlashcard(id: string): Promise<StudyCoachFlashcard> {
    return authenticatedRequest(`/study-coach/flashcards/${encodeURIComponent(id)}`);
  },

  reviewFlashcard(
    id: string,
    rating: 1 | 2 | 3 | 4,
    clientEventId: string,
  ): Promise<FlashcardReviewResult> {
    return authenticatedRequest(`/study-coach/flashcards/${encodeURIComponent(id)}/review`, {
      method: "POST",
      body: JSON.stringify({ rating, clientEventId }),
    });
  },

  completeFlashcardSession(input: {
    documentId: string;
    reviewedCardCount: number;
    mode: "DUE" | "ALL";
    clientEventId: string;
  }): Promise<{ eventId: string; completedAt: string; idempotentReplay: boolean }> {
    return authenticatedRequest("/study-coach/flashcards/sessions/complete", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getQuizzes(documentId?: string): Promise<{ items: StudyCoachQuizSummary[]; total: number }> {
    const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : "";
    return authenticatedRequest(`/study-coach/quizzes${query}`);
  },

  getQuizHistory(documentId?: string): Promise<{ items: StudyCoachQuizHistoryItem[]; total: number }> {
    const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : "";
    return authenticatedRequest(`/study-coach/quizzes/history${query}`, { cache: "no-store" });
  },

  getQuizExport(examId: string): Promise<StudyCoachQuizExport> {
    return authenticatedRequest(`/study-coach/quizzes/${encodeURIComponent(examId)}/export`);
  },

  startQuiz(
    examId: string,
    clientEventId: string,
  ): Promise<StudyCoachQuizState> {
    return authenticatedRequest(`/study-coach/quizzes/${encodeURIComponent(examId)}/start`, {
      method: "POST",
      body: JSON.stringify({ clientEventId }),
    });
  },

  getQuizAttempt(attemptId: string): Promise<StudyCoachQuizState> {
    return authenticatedRequest(`/study-coach/quizzes/attempts/${encodeURIComponent(attemptId)}`);
  },

  submitQuizAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIndexes: number[],
    clientEventId: string,
    textAnswer?: string,
  ): Promise<StudyCoachQuizAnswerResult> {
    return authenticatedRequest(
      `/study-coach/quizzes/attempts/${encodeURIComponent(attemptId)}/answers`,
      {
        method: "POST",
        body: JSON.stringify({
          questionId,
          ...(textAnswer ? { textAnswer } : { selectedOptionIndexes }),
          clientEventId,
        }),
      },
    );
  },

  submitQuiz(attemptId: string, clientEventId: string): Promise<StudyCoachQuizResult> {
    return authenticatedRequest(
      `/study-coach/quizzes/attempts/${encodeURIComponent(attemptId)}/submit`,
      { method: "POST", body: JSON.stringify({ clientEventId }) },
    );
  },

  getQuizResult(attemptId: string): Promise<StudyCoachQuizResult> {
    return authenticatedRequest(
      `/study-coach/quizzes/attempts/${encodeURIComponent(attemptId)}/result`,
    );
  },

  getMastery(filters: {
    documentId?: string;
    topicId?: string;
    conceptId?: string;
    state?: ConceptMasteryState;
  } = {}): Promise<ConceptMasteryResult> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const query = params.toString();
    return authenticatedRequest(`/study-coach/mastery${query ? `?${query}` : ""}`, {
      cache: "no-store",
    });
  },

  getConceptMastery(conceptId: string): Promise<ConceptMasteryView> {
    return authenticatedRequest(`/study-coach/mastery/concepts/${encodeURIComponent(conceptId)}`);
  },

  getInsights(filters: {
    scope: InsightScope;
    documentId?: string;
  }): Promise<{ items: LearningInsight[]; total: number }> {
    const params = new URLSearchParams({ scope: filters.scope, language: "vi" });
    if (filters.documentId) params.set("documentId", filters.documentId);
    return authenticatedRequest(`/study-coach/insights?${params.toString()}`);
  },

  generateInsight(input: {
    scope: InsightScope;
    documentId?: string;
  }): Promise<LearningInsight> {
    return authenticatedRequest("/study-coach/insights/generate", {
      method: "POST",
      body: JSON.stringify({ ...input, language: "vi" }),
    });
  },

  getInsight(id: string): Promise<LearningInsight> {
    return authenticatedRequest(`/study-coach/insights/${encodeURIComponent(id)}`);
  },
};
