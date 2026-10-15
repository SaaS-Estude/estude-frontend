import { authenticatedRequest } from "@/lib/auth-api";
import type {
  LearningSupportInbox,
  LearningSupportRequest,
  LearningSupportStatus,
} from "@/types/assessment";

export const LEARNING_SUPPORT_CHANGED_EVENT = "estude:learning-support-changed";

export const learningSupportService = {
  listTeacher(status?: LearningSupportStatus): Promise<LearningSupportInbox> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return authenticatedRequest(`/learning-plans/teacher/support-requests${query}`);
  },
  unreadCount(): Promise<{ count: number }> {
    return authenticatedRequest(
      "/learning-plans/teacher/support-requests/unread-count",
    );
  },
  getTeacher(requestId: string): Promise<LearningSupportRequest> {
    return authenticatedRequest(
      `/learning-plans/teacher/support-requests/${encodeURIComponent(requestId)}`,
    );
  },
  updateStatus(
    requestId: string,
    status: LearningSupportStatus,
  ): Promise<LearningSupportRequest> {
    return authenticatedRequest(
      `/learning-plans/teacher/support-requests/${encodeURIComponent(requestId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
  },
  reply(requestId: string, content: string): Promise<LearningSupportRequest> {
    return authenticatedRequest(
      `/learning-plans/teacher/support-requests/${encodeURIComponent(requestId)}/replies`,
      { method: "POST", body: JSON.stringify({ content }) },
    );
  },
  listStudent(planId: string): Promise<LearningSupportRequest[]> {
    return authenticatedRequest(
      `/learning-plans/${encodeURIComponent(planId)}/support-requests`,
    );
  },
  markStudentRead(
    planId: string,
    requestId: string,
  ): Promise<LearningSupportRequest> {
    return authenticatedRequest(
      `/learning-plans/${encodeURIComponent(planId)}/support-requests/${encodeURIComponent(requestId)}/read`,
      { method: "POST" },
    );
  },
};
