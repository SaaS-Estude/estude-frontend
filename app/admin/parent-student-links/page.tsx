import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Liên kết phụ huynh – học sinh",
  description: "Quản lý liên kết phụ huynh và học sinh trong EStude.",
};

export default function ParentStudentLinksPage() {
  return <RoleGate allowedRole="ADMIN"><StaffDashboardView /></RoleGate>;
}
