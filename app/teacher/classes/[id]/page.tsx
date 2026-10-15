import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Không gian lớp học",
  description: "Quản lý chủ đề và tài liệu của lớp học được phân công.",
};

export default function TeacherClassDetailPage() {
  return <RoleGate allowedRole="TEACHER"><StaffDashboardView /></RoleGate>;
}
