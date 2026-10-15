import type { UserRole } from "@/types/auth";

export const MODULE_LINKS = [
  {
    href: "/admin/dashboard",
    label: "Tổng quan quản lý",
    permission: "dashboard.read",
  },
  { href: "/admin/accounts", label: "Tài khoản", permission: "accounts.read" },
  {
    href: "/admin/users/teachers",
    label: "Giáo viên",
    permission: "accounts.read",
  },
  {
    href: "/admin/users/students",
    label: "Học sinh",
    permission: "accounts.read",
  },
  {
    href: "/admin/users/parents",
    label: "Phụ huynh",
    permission: "accounts.read",
  },
  {
    href: "/admin/parent-student-links",
    label: "Liên kết phụ huynh – học sinh",
    permission: "parent_links.read",
  },
  {
    href: "/admin/academic-data",
    label: "Dữ liệu học vụ",
    permission: "academic.read",
  },
  { href: "/admin/subjects", label: "Danh mục môn học", permission: "subjects.read" },
  { href: "/admin/course-offerings", label: "Lớp môn học", permission: "course_offerings.read" },
  { href: "/admin/classes", label: "Lớp học", permission: "classes.read" },
  {
    href: "/admin/subject-assignments",
    label: "Phân công bộ môn",
    permission: "assignments.read",
  },
  {
    href: "/admin/settings/permissions",
    label: "Phân quyền động",
    permission: "authorization.read",
  },
  {
    href: "/admin/settings/default-passwords",
    label: "Mật khẩu mặc định",
    permission: "password_settings.read",
  },
  {
    href: "/admin/settings/parent-links",
    label: "Cấu hình liên kết phụ huynh",
    permission: "system_settings.read",
  },
  {
    href: "/admin/settings/ai-question",
    label: "Cấu hình AI",
    permission: "ai_settings.read",
  },
  {
    href: "/teacher/courses",
    label: "Môn học được phân công",
    permission: "teaching.read",
  },
  {
    href: "/teacher/classes",
    label: "Lớp được phân công",
    permission: "teaching.read",
  },
  {
    href: "/teacher/students",
    label: "Học sinh được phân công",
    permission: "teaching.read",
  },
  {
    href: "/teacher/materials",
    label: "Thư viện tài liệu",
    permission: "materials.read",
  },
  {
    href: "/teacher/question-bank",
    label: "Ngân hàng câu hỏi",
    permission: "questions.read",
  },
  {
    href: "/teacher/exams",
    label: "Quản lý bài kiểm tra",
    permission: "exams.read",
  },
  {
    href: "/teacher/learning-support",
    label: "Theo dõi học tập",
    permission: "exams.submissions",
  },
  {
    href: "/teacher/settings/exam-defaults",
    label: "Cấu hình bài kiểm tra",
    permission: "teacher_settings.read",
  },
  {
    href: "/teacher/attendance",
    label: "Điểm danh",
    permission: "attendance.read",
  },
  {
    href: "/teacher/notifications",
    label: "Gửi thông báo",
    permission: "notifications.send",
  },
  {
    href: "/student/courses",
    label: "Môn học của tôi",
    permission: "learning.read",
  },
  {
    href: "/student/grades",
    label: "Điểm số của tôi",
    permission: "learning.read",
  },
  { href: "/student/assignments", label: "Bài tập của tôi", permission: "learning.read" },
  { href: "/student/review", label: "Ôn tập", permission: "study.read" },
  {
    href: "/student/activity",
    label: "Điểm danh & thông báo",
    permission: "notifications.read",
  },
  {
    href: "/parent/dashboard",
    label: "Học sinh liên kết",
    permission: "children.read",
  },
] as const;

export function routePermission(path: string): string | null {
  if (path === "/help") return null;
  if (path.endsWith("/settings/sessions")) return null;
  if (
    path === "/student/study-coach" ||
    path.startsWith("/student/study-coach/")
  )
    return "study.read";
  if (
    path === "/student/learning-plans" ||
    path.startsWith("/student/learning-plans/")
  )
    return "study.read";
  if (path === "/admin/users") return "accounts.read";
  if (/^\/(admin\/users|teacher)\/students\/[^/]+$/.test(path))
    return "student_reports.read";
  if (path === "/teacher/question-bank/generate") return "ai_questions.create";
  if (path === "/teacher/question-bank/new") return "questions.create";
  if (/^\/teacher\/question-bank\/[^/]+\/edit$/.test(path))
    return "questions.update";
  if (path === "/teacher/exams/new") return "exams.create";
  if (/^\/teacher\/exams\/[^/]+\/edit$/.test(path)) return "exams.update";
  if (
    path.includes("/submissions") ||
    /^\/teacher\/exams\/[^/]+\/(analysis|subject-support)$/.test(path)
  )
    return "exams.submissions";
  if (
    path === "/teacher/learning-plans" ||
    path.startsWith("/teacher/learning-plans/")
  )
    return "exams.submissions";
  if (path === "/teacher/cohorts" || path.startsWith("/teacher/cohorts/"))
    return "exams.submissions";
  if (
    path === "/teacher/support-requests" ||
    path.startsWith("/teacher/support-requests/")
  )
    return "exams.submissions";
  if (path.startsWith("/student/attempts/") && path.endsWith("/study"))
    return "study.read";
  if (
    path.startsWith("/student/attempts/") ||
    path.startsWith("/student/exams") ||
    path === "/student/dashboard"
  )
    return "learning.read";
  if (path === "/teacher/dashboard") return "teaching.read";
  const link = MODULE_LINKS.find(
    (item) => path === item.href || path.startsWith(`${item.href}/`),
  );
  if (link) return link.permission;
  if (path.startsWith("/admin/settings")) return "system_settings.read";
  return "__unmapped__";
}

/** Route prefixes are role workspaces, even when RBAC grants overlap. */
export function canVisitRoute(path: string, role: UserRole, permissions: readonly string[]): boolean {
  const workspace = path.match(/^\/(admin|teacher|student|parent)(?:\/|$)/)?.[1];
  if (workspace && workspace.toUpperCase() !== role) return false;
  const permission = routePermission(path);
  return permission === null || permissions.includes(permission);
}
