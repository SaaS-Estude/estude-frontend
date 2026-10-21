import { authenticatedRequest } from "@/lib/auth-api";

export type OnlineSessionInput = {
  requestKey: string; revision: number; organizerId: string; title: string; description: string;
  platform: "MEET" | "ZOOM"; meetingUrl: string; startsAt: string; endsAt: string;
  meetingPasscode?: string;
  audience: "ALL" | "SELECTED"; status: "DRAFT" | "SCHEDULED"; studentIds: string[];
};
export type OnlineSession = Omit<OnlineSessionInput, "status" | "requestKey"> & {
  id: string; courseOfferingId: string; courseName: string; classId: string; className: string;
  subjectName: string; termId: string; organizerName: string; status: "DRAFT" | "SCHEDULED" | "CANCELLED";
  state: "DRAFT" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  canEdit: boolean; canCancel: boolean; canJoin: boolean; joinOpensAt: string; serverNow: string;
  cancelReason: string;
};
export type OnlinePerson = { id: string; fullName: string; accountName: string };
export type OnlineRoster = { students: OnlinePerson[]; teachers: OnlinePerson[] };
export type SessionHistory = {
  audits: { id: string; revision: number; action: string; createdAt: string; details: { title: string; startsAt: string; endsAt: string; cancelReason: string } }[];
  joinClicks: { userId: string; fullName: string; clicks: number; lastClickedAt: string }[];
};
export type OnlineRole = "teacher" | "student" | "admin";
const prefix = (role: OnlineRole) => role === "admin" ? "" : `/${role}`;
const source = (role: OnlineRole, id: string) => `${prefix(role)}/online-sessions/${encodeURIComponent(id)}`;
const scope = (id = "") => ({ "X-Course-Offering-ID": id });
const json = (method: string, body?: unknown) => ({ method, headers: scope(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const onlineSessionApi = {
  list: (role: OnlineRole, courseId?: string) => authenticatedRequest<OnlineSession[]>(courseId ? `${prefix(role)}/course-offerings/${encodeURIComponent(courseId)}/online-sessions` : `${prefix(role)}/online-sessions`, { headers: scope(courseId) }),
  detail: (role: OnlineRole, id: string) => authenticatedRequest<OnlineSession>(source(role, id), { headers: scope() }),
  roster: (role: OnlineRole, courseId: string) => authenticatedRequest<OnlineRoster>(`${prefix(role)}/course-offerings/${encodeURIComponent(courseId)}/online-session-roster`, { headers: scope(courseId) }),
  save: (role: OnlineRole, courseId: string, id: string | undefined, input: OnlineSessionInput) => authenticatedRequest<OnlineSession>(id ? source(role, id) : `${prefix(role)}/course-offerings/${encodeURIComponent(courseId)}/online-sessions`, { ...json(id ? "PATCH" : "POST", input), headers: scope(courseId) }),
  cancel: (role: OnlineRole, row: OnlineSession, reason: string) => authenticatedRequest(source(role, row.id) + "/cancel", json("POST", { revision: row.revision, reason })),
  remove: (role: OnlineRole, row: OnlineSession) => authenticatedRequest(source(role, row.id), json("DELETE", { revision: row.revision })),
  join: (role: OnlineRole, id: string) => authenticatedRequest<{ url: string; meetingPasscode?: string }>(source(role, id) + "/join", json("POST")),
  history: (role: OnlineRole, id: string) => authenticatedRequest<SessionHistory>(source(role, id) + "/history", { headers: scope() }),
};
