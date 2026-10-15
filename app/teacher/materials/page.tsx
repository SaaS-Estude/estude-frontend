import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Thư viện tài liệu",
  description: "Quản lý và phân phối tài liệu đến nhiều lớp học.",
};

export default function TeacherMaterialsPage() {
  return <RoleGate allowedRole="TEACHER"><StaffDashboardView /></RoleGate>;
}
