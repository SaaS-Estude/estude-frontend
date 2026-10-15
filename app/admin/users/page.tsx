import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Người dùng",
  description: "Quản lý thông tin giáo viên và học sinh EStude.",
};

export default function AdminUsersPage() {
  return (
    <RoleGate allowedRole="ADMIN">
      <StaffDashboardView />
    </RoleGate>
  );
}
