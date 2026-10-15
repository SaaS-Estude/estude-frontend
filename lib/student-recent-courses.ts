const RECENT_COURSES_STORAGE_KEY = "estude:student:recent-courses";
const MAX_RECENT_COURSES = 6;

export interface RecentStudentCourseAccess {
  classId: string;
  subjectId: string;
  visitedAt: string;
}

function isRecentCourseAccess(value: unknown): value is RecentStudentCourseAccess {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.classId === "string" &&
    typeof item.subjectId === "string" &&
    typeof item.visitedAt === "string" &&
    Number.isFinite(new Date(item.visitedAt).getTime())
  );
}

export function getRecentStudentCourseAccesses(): RecentStudentCourseAccess[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_COURSES_STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isRecentCourseAccess).slice(0, MAX_RECENT_COURSES)
      : [];
  } catch {
    return [];
  }
}

export function rememberStudentCourseAccess(
  classId: string,
  subjectId: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const nextAccess: RecentStudentCourseAccess = {
      classId,
      subjectId,
      visitedAt: new Date().toISOString(),
    };
    const remaining = getRecentStudentCourseAccesses().filter(
      (item) => item.classId !== classId || item.subjectId !== subjectId,
    );
    window.localStorage.setItem(
      RECENT_COURSES_STORAGE_KEY,
      JSON.stringify([nextAccess, ...remaining].slice(0, MAX_RECENT_COURSES)),
    );
  } catch {
    // The course page remains usable when browser storage is unavailable.
  }
}
