import { authenticatedRequest } from "@/lib/auth-api";

export type CourseStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
export type CourseEnrollmentMode = "CLASS_ROSTER" | "MANUAL";
export type CourseTeacherRole = "PRIMARY_TEACHER" | "CO_TEACHER";

export interface CourseOffering {
  id: string;
  academicYearId: string;
  termId: string;
  primaryClassId: string;
  subjectId: string;
  sectionKey: string;
  displayName: string;
  displayNameOverride: string | null;
  enrollmentMode: CourseEnrollmentMode;
  status: CourseStatus;
  readyForOpen: boolean;
  schoolClass?: { id: string; code: string; name: string };
  subject?: { id: string; code: string; name: string; vietnameseName: string | null };
  term?: { id: string; name: string; status: string };
  activeTeachers: Array<{ teacherId: string; role: CourseTeacherRole }>;
  activeStudentCount: number;
}

export interface CourseMembers {
  teachers: Array<{
    id: string; teacherId: string; role: CourseTeacherRole;
    effectiveFrom: string; effectiveTo: string | null;
    user: { id: string; fullName: string; accountName: string } | null;
  }>;
  enrollments: Array<{
    id: string; studentId: string; status: "ACTIVE" | "WITHDRAWN";
    enrolledAt: string; withdrawnAt: string | null;
    user: { id: string; fullName: string; accountName: string } | null;
  }>;
}

const path = (id: string) => `/course-offerings/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const courseOfferingApi = {
  readiness: () => authenticatedRequest<{ dbPrepared: boolean; cutoverReady: boolean }>("/course-offerings/readiness"),
  list: () => authenticatedRequest<CourseOffering[]>("/course-offerings"),
  get: (id: string) => authenticatedRequest<CourseOffering>(path(id)),
  members: (id: string) => authenticatedRequest<CourseMembers>(`${path(id)}/members`),
  create: (input: { termId: string; primaryClassId: string; subjectId: string;
    sectionKey?: string; displayNameOverride?: string; enrollmentMode: CourseEnrollmentMode }) =>
    authenticatedRequest<CourseOffering>("/course-offerings", json("POST", input)),
  assignTeacher: (id: string, teacherId: string, role: CourseTeacherRole) =>
    authenticatedRequest(`${path(id)}/teachers`, json("POST", { teacherId, role })),
  replacePrimary: (id: string, teacherId: string) =>
    authenticatedRequest(`${path(id)}/primary-teacher`, json("POST", { teacherId })),
  endTeacher: (id: string, teacherId: string) =>
    authenticatedRequest(`${path(id)}/teachers/${encodeURIComponent(teacherId)}`, { method: "DELETE" }),
  enroll: (id: string, studentId: string) =>
    authenticatedRequest(`${path(id)}/students`, json("POST", { studentId })),
  withdraw: (id: string, studentId: string) =>
    authenticatedRequest(`${path(id)}/students/${encodeURIComponent(studentId)}`, { method: "DELETE" }),
  transition: (id: string, action: "open" | "close" | "archive") =>
    authenticatedRequest(`${path(id)}/${action}`, json("POST", {})),
};
