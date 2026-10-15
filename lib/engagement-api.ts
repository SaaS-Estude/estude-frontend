import { authenticatedRequest } from "@/lib/auth-api";
import type {
  AttendanceRecord,
  AttendanceHistoryRecord,
  AttendanceRoster,
  AttendanceStatus,
  PortalNotification,
  ParentOverview,
  AttendanceSession,
  AttendanceSessionDetail,
  AttendanceAudit,
  AttendanceVersion,
} from "@/types/engagement";

export const NOTIFICATIONS_CHANGED_EVENT = "estude:notifications-changed";

export const attendanceService = {
  listSessions(classId: string, subjectId: string, date: string): Promise<AttendanceSession[]> {
    const query = new URLSearchParams({ subjectId, date });
    return authenticatedRequest(`/attendance/classes/${encodeURIComponent(classId)}/sessions?${query}`);
  },
  createSession(classId: string, payload: { subjectId: string; date: string;
    startTime?: string; endTime?: string; period?: string; label?: string; status?: 'DRAFT' | 'OPEN' }): Promise<AttendanceSession> {
    return authenticatedRequest(`/attendance/classes/${encodeURIComponent(classId)}/sessions`, {
      method: 'POST', body: JSON.stringify(payload),
    });
  },
  getSession(id: string): Promise<AttendanceSessionDetail> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}`);
  },
  openSession(id: string, version: AttendanceVersion): Promise<AttendanceSession> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}/open`, { method: 'POST', body: JSON.stringify(version) });
  },
  saveSession(id: string, records: Array<{ studentId: string; status: AttendanceStatus; note?: string }>, version: AttendanceVersion, reason?: string): Promise<{ sessionId: string; changed: number; unchanged: number; updatedAt: string; reopenedCount: number }> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}/records`, {
      method: 'PUT', body: JSON.stringify({ records, reason, ...version }),
    });
  },
  finalizeSession(id: string, version: AttendanceVersion): Promise<AttendanceSession> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}/finalize`, { method: 'POST', body: JSON.stringify(version) });
  },
  reopenSession(id: string, reason: string, version: AttendanceVersion): Promise<AttendanceSession> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}/reopen`, {
      method: 'POST', body: JSON.stringify({ reason, ...version }),
    });
  },
  getAudit(id: string): Promise<AttendanceAudit[]> {
    return authenticatedRequest(`/attendance/sessions/${encodeURIComponent(id)}/audit`);
  },
  getClassRoster(
    classId: string,
    subjectId: string,
    date: string,
  ): Promise<AttendanceRoster> {
    const query = new URLSearchParams({ subjectId, date });
    return authenticatedRequest<AttendanceRoster>(
      `/attendance/classes/${encodeURIComponent(classId)}?${query}`,
    );
  },
  saveClassRoster(
    classId: string,
    subjectId: string,
    date: string,
    records: Array<{ studentId: string; status: AttendanceStatus }>,
  ): Promise<{ date: string; records: AttendanceRecord[] }> {
    return authenticatedRequest(
      `/attendance/classes/${encodeURIComponent(classId)}`,
      {
        method: "POST",
        body: JSON.stringify({ subjectId, date, records }),
      },
    );
  },
  getMine(filters: { termId?: string; subjectId?: string; limit?: number } = {}): Promise<AttendanceHistoryRecord[]> {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return authenticatedRequest<AttendanceHistoryRecord[]>(`/attendance/me?${query}`);
  },
  getChild(studentId: string, filters: { termId?: string; subjectId?: string; limit?: number } = {}): Promise<AttendanceHistoryRecord[]> {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return authenticatedRequest<AttendanceHistoryRecord[]>(
      `/attendance/children/${encodeURIComponent(studentId)}?${query}`,
    );
  },
};

export const notificationService = {
  getMine(): Promise<PortalNotification[]> {
    return authenticatedRequest<PortalNotification[]>("/notifications/me");
  },
  markRead(id: string): Promise<Record<string, never>> {
    return authenticatedRequest(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
    );
  },
  sendClass(payload: {
    classId: string;
    subjectId: string;
    audience: "STUDENTS" | "PARENTS";
    title: string;
    message: string;
  }): Promise<{ recipientCount: number }> {
    return authenticatedRequest("/notifications/class", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  broadcast(payload: {
    targetRole?: "TEACHER" | "STUDENT" | "PARENT";
    title: string;
    message: string;
  }): Promise<{ recipientCount: number }> {
    return authenticatedRequest("/notifications/system", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const parentEngagementService = {
  getOverview(studentId?: string): Promise<ParentOverview> {
    return authenticatedRequest<ParentOverview>(
      studentId
        ? `/parent/children/${encodeURIComponent(studentId)}/overview`
        : "/parent/overview",
    );
  },
};
