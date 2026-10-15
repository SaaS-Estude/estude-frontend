import { authenticatedRequest } from "./auth-api";
import type {
  Assignment,
  AssignmentInput,
  AssignmentTerm,
  StudentAssignmentDetail,
  SubmissionAttempt,
  SubmissionFile,
  TeacherAssignmentDetail,
} from "@/types/assignment";
import type { ContentStatus } from "@/types/assessment";
const request = <T>(path: string, method: string, payload?: unknown) =>
  authenticatedRequest<T>(path, {
    method,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
export const assignmentService = {
  listTeacher: (lessonId: string) =>
    authenticatedRequest<{
      assignments: Assignment[];
      terms: AssignmentTerm[];
      serverNow: string;
    }>(`/teacher/lessons/${lessonId}/assignments`),
  create: (lessonId: string, payload: AssignmentInput) =>
    request<Assignment>(
      `/teacher/lessons/${lessonId}/assignments`,
      "POST",
      payload,
    ),
  update: (id: string, payload: AssignmentInput & { revision: number }) =>
    request<Assignment>(`/teacher/assignments/${id}`, "PATCH", payload),
  lifecycle: (id: string, status: ContentStatus, revision: number) =>
    request<Assignment>(`/teacher/assignments/${id}/lifecycle`, "PATCH", {
      status,
      revision,
    }),
  remove: (id: string) => request(`/teacher/assignments/${id}`, "DELETE"),
  teacherDetail: (id: string, filter = "ALL") =>
    authenticatedRequest<TeacherAssignmentDetail>(
      `/teacher/assignments/${id}?filter=${encodeURIComponent(filter)}`,
    ),
  preview: (id: string) =>
    authenticatedRequest<TeacherAssignmentDetail>(
      `/teacher/assignments/${id}/preview`,
    ),
  teacherAttempt: (id: string) =>
    authenticatedRequest<{
      attempt: SubmissionAttempt;
      audit: Array<{
        id: string;
        action: string;
        actorId: string;
        before: unknown;
        after: unknown;
        reason: string;
        createdAt: string;
      }>;
    }>(`/teacher/assignment-submissions/${id}`),
  grade: (
    id: string,
    score: number,
    feedback: string,
    revision: number,
    reason: string,
  ) =>
    request<SubmissionAttempt>(
      `/teacher/assignment-submissions/${id}/grade`,
      "PATCH",
      { score, feedback, revision, reason },
    ),
  returnGrade: (id: string, revision: number) =>
    request<SubmissionAttempt>(
      `/teacher/assignment-submissions/${id}/return`,
      "POST",
      { revision },
    ),
  excuse: (
    id: string,
    studentId: string,
    excused: boolean,
    reason: string,
    revision: number,
  ) =>
    request(
      `/teacher/assignments/${id}/recipients/${studentId}/excuse`,
      "PATCH",
      { excused, reason, revision },
    ),
  listStudent: (lessonId?: string, history = false) =>
    authenticatedRequest<{
      assignments: StudentAssignmentDetail[];
      serverNow: string;
    }>(
      history
        ? "/student/assignments/history"
        : `/student/assignments${lessonId ? `?lessonId=${encodeURIComponent(lessonId)}` : ""}`,
    ),
  studentDetail: (id: string, history = false) =>
    authenticatedRequest<StudentAssignmentDetail>(
      `/student/assignments/${id}${history ? "/history" : ""}`,
    ),
  submit: (
    id: string,
    payload: { idempotencyKey: string; textContent: string; fileIds: string[] },
  ) =>
    request<SubmissionAttempt>(
      `/student/assignments/${id}/submissions`,
      "POST",
      payload,
    ),
  fileAccess: (id: string) =>
    authenticatedRequest<{ url: string; expiresIn: number }>(
      `/assignment-files/${id}/access`,
    ),
  async upload(id: string, file: File) {
    const contentType =
      file.type ||
      (file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : file.name.toLowerCase().endsWith(".txt")
          ? "text/plain"
          : "application/octet-stream");
    const session = await request<{ file: SubmissionFile; uploadUrl: string }>(
      `/student/assignments/${id}/files/upload-url`,
      "POST",
      { fileName: file.name, contentType, fileSize: file.size },
    );
    const response = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!response.ok) throw new Error("Không thể upload file bài nộp");
    return request<SubmissionFile>(
      `/student/assignment-files/${session.file.id}/confirm`,
      "POST",
    );
  },
};

// Retain an unfinished submission key across retry/refresh without storing text content.
export async function submissionKey(
  id: string,
  textContent: string,
  fileIds: string[],
) {
  const payload = JSON.stringify({
    textContent: textContent.trim(),
    fileIds: [...fileIds].sort(),
  });
  const bytes = new TextEncoder().encode(payload);
  const fingerprint = globalThis.crypto?.subtle
    ? Array.from(
        new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    : `${Array.from(payload).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0}-${payload.length}`;
  const cacheId = `estude:pending-assignment:${id}`;
  try {
    const previous = JSON.parse(localStorage.getItem(cacheId) ?? "null") as {
      fingerprint?: string;
      key?: string;
    } | null;
    if (previous?.fingerprint === fingerprint && previous.key)
      return previous.key;
  } catch {
    /* Browser privacy mode may disable local storage. */
  }
  const key =
    globalThis.crypto?.randomUUID?.() ??
    `submit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(cacheId, JSON.stringify({ fingerprint, key }));
  } catch {
    /* Memory/ref retry remains available. */
  }
  return key;
}
export function clearSubmissionKey(id: string) {
  try {
    localStorage.removeItem(`estude:pending-assignment:${id}`);
  } catch {
    /* Optional browser persistence. */
  }
}
