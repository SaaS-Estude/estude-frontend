import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Môn học được phân công",
  description: "Quản lý môn học tại các lớp được phân công giảng dạy.",
};

export default function TeacherCoursesPage() {
  return <RoleGate allowedRole="TEACHER"><StaffDashboardView /></RoleGate>;
}
