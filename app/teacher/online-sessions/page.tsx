import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Buổi học online",
  description: "Tạo và quản lý buổi học Zoom, Google Meet cho các môn được phân công.",
};

export default function TeacherOnlineSessionsPage() {
  return <RoleGate allowedRole="TEACHER"><StaffDashboardView /></RoleGate>;
}
