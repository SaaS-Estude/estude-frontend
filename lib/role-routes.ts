import type { UserRole } from "@/types/auth";

export function getRoleHome(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "STUDENT":
      return "/student/dashboard";
    case "PARENT":
      return "/parent/dashboard";
  }
}

export function getRoleSessionSettings(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin/settings/sessions";
    case "TEACHER":
      return "/teacher/settings/sessions";
    case "STUDENT":
      return "/student/settings/sessions";
    case "PARENT":
      return "/parent/settings/sessions";
  }
}

export function getRoleLogin(role: UserRole): string {
  void role;
  return "/login";
}
