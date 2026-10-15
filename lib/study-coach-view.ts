import { ApiError } from "@/lib/auth-api";
import type {
  ConceptMasteryState,
  InsightActionType,
  KnowledgeConceptRelationType,
  StudyCoachMaterialLifecycle,
} from "@/types/study-coach";

export const materialLifecycleLabels: Record<StudyCoachMaterialLifecycle, string> = {
  UPLOAD_PENDING: "Đang chờ tải lên",
  READY_TO_PROCESS: "Đã tải lên · Đang chờ xử lý",
  PROCESSING: "AI đang phân tích tài liệu...",
  CANCELLED: "Đã hủy xử lý",
  READY: "Sẵn sàng học",
  FAILED: "Không thể xử lý tài liệu",
  UNAVAILABLE: "Tài liệu tạm thời không khả dụng",
};

export const materialLifecycleTones: Record<StudyCoachMaterialLifecycle, string> = {
  UPLOAD_PENDING: "border-slate-200 bg-slate-50 text-slate-700",
  READY_TO_PROCESS: "border-blue-200 bg-blue-50 text-brand-700",
  PROCESSING: "border-amber-200 bg-amber-50 text-amber-800",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  UNAVAILABLE: "border-slate-200 bg-slate-100 text-slate-600",
};

export const relationLabels: Record<KnowledgeConceptRelationType, string> = {
  PREREQUISITE: "là kiến thức nền cho",
  PART_OF: "là một phần của",
  RELATED_TO: "liên quan đến",
  CAUSES: "dẫn đến",
  CONTRASTS: "đối chiếu với",
};

export const conceptImportanceLabels = {
  CORE: "Kiến thức trọng tâm",
  SUPPORTING: "Kiến thức bổ trợ",
} as const;

const publicFailureLabels: Record<string, string> = {
  EMPTY_DOCUMENT: "Tài liệu không có nội dung văn bản để phân tích.",
  DOCUMENT_TOO_LARGE: "Nội dung tài liệu vượt giới hạn xử lý hiện tại.",
  INVALID_PDF: "Tệp PDF không hợp lệ hoặc không thể đọc.",
  INVALID_DOCUMENT: "Tệp PDF không hợp lệ, bị thiếu hoặc không thể đọc.",
  UNSUPPORTED_FILE_TYPE: "Định dạng tài liệu này chưa được hỗ trợ.",
  MISSING_SUBJECT: "Môn học của tài liệu không còn khả dụng.",
  AI_TIMEOUT: "Dịch vụ phân tích chưa phản hồi kịp thời.",
  AI_UNAVAILABLE: "Dịch vụ phân tích tạm thời không khả dụng.",
  AI_RATE_LIMIT: "Dịch vụ phân tích đang quá tải. Hệ thống sẽ thử lại có giới hạn.",
  AI_CONFIGURATION_ERROR: "Dịch vụ AI chưa được cấu hình đúng. Vui lòng liên hệ quản trị viên.",
  AI_REQUEST_INVALID: "Yêu cầu phân tích chưa tương thích với dịch vụ AI. Vui lòng thử lại sau khi hệ thống được cập nhật.",
  TEMPORARY_PROVIDER_ERROR: "Dịch vụ phân tích tạm thời không khả dụng.",
  TRANSIENT_STORAGE_ERROR: "Chưa thể đọc tài liệu từ kho lưu trữ.",
  STORAGE_CONFIGURATION_ERROR: "Kho tài liệu chưa được cấu hình đúng. Vui lòng liên hệ quản trị viên.",
  INVALID_AI_OUTPUT: "Kết quả phân tích không vượt qua kiểm tra an toàn.",
  SOURCE_REFERENCE_INVALID: "Kết quả phân tích không khớp nguồn tài liệu.",
  PERSISTENCE_ERROR: "Chưa thể lưu trọn vẹn nội dung học tập.",
  RETRY_LIMIT_EXCEEDED: "Đã hết số lần thử xử lý tự động.",
  USER_CANCELLED: "Bạn đã hủy lần xử lý này. Có thể bắt đầu xử lý lại khi cần.",
};

export function publicFailureMessage(code: string | null): string | null {
  return code ? publicFailureLabels[code] ?? null : null;
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const masteryLabels: Record<ConceptMasteryState, string> = {
  STRONG: "Nắm rất vững",
  PROFICIENT: "Nắm vững",
  DEVELOPING: "Đang tiến bộ",
  NEEDS_SUPPORT: "Cần ôn lại",
  NEW: "Chưa đủ dữ liệu",
};

export const masteryTones: Record<ConceptMasteryState, string> = {
  STRONG: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROFICIENT: "border-blue-200 bg-blue-50 text-brand-700",
  DEVELOPING: "border-amber-200 bg-amber-50 text-amber-700",
  NEEDS_SUPPORT: "border-rose-200 bg-rose-50 text-rose-700",
  NEW: "border-slate-200 bg-slate-50 text-slate-600",
};

export const difficultyLabels = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Thử thách",
} as const;

export const actionLabels: Record<InsightActionType, string> = {
  LEARN: "Xem lại kiến thức",
  PRACTICE: "Làm bài luyện",
  REVIEW: "Ôn thẻ ghi nhớ",
  CHALLENGE: "Làm bài nâng cao",
};

export function actionHref(action: InsightActionType, documentId?: string): string {
  if (documentId) {
    const materialPath = `/student/study-coach/materials/${encodeURIComponent(documentId)}`;
    if (action === "LEARN") return `${materialPath}/knowledge-map`;
    if (action === "REVIEW") return `${materialPath}/flashcards`;
    return `${materialPath}/quiz`;
  }
  const path = action === "REVIEW"
    ? "/student/review/flashcards"
    : action === "LEARN"
      ? "/student/study-coach/mastery"
      : "/student/review/quiz";
  return path;
}

export function studentError(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) return cause instanceof Error ? cause.message : fallback;
  if (cause.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (cause.status === 0) return "Bạn đang ngoại tuyến. Hãy kiểm tra mạng rồi thử lại.";
  if (cause.status === 403) return "Bạn không có quyền truy cập nội dung này.";
  if (cause.status === 404) return "Nội dung không còn tồn tại hoặc bạn không có quyền truy cập.";
  if (cause.status === 409) return "Dữ liệu đã thay đổi. Hãy tải lại trạng thái mới nhất.";
  if (cause.status === 413) return "Phạm vi học tập quá lớn để phân tích trong một lần.";
  if (cause.status === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
  if (cause.status >= 500) return "Study Coach tạm thời chưa phản hồi. Vui lòng thử lại sau.";
  return cause.message || fallback;
}

export function materialError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 403 && /hết hạn/i.test(cause.message)) return cause.message;
    if (cause.status === 404) return "Không tìm thấy tài liệu.";
    if (cause.status === 409) return "Tài liệu đang được xử lý. Vui lòng thử lại sau.";
    if (cause.status === 413) return "Tài liệu vượt quá giới hạn 50 MB.";
  }
  return studentError(cause, fallback);
}

export function knowledgeMapError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 404) return "Không tìm thấy tài liệu.";
    if (cause.status === 409) return "Bản đồ kiến thức đang được chuẩn bị.";
    if (cause.status === 503) return "Không thể tải bản đồ kiến thức lúc này. Vui lòng thử lại sau.";
  }
  return studentError(cause, "Không thể tải bản đồ kiến thức lúc này.");
}

export function isInsightDisabled(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 503 && /not enabled|chưa.*bật/i.test(cause.message);
}
