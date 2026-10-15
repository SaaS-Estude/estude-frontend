import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Phụ huynh",
  description: "Quản lý thông tin phụ huynh EStude.",
};

export default function AdminParentsPage() {
  return (
    <RoleGate allowedRole="ADMIN">
      <StaffDashboardView />
    </RoleGate>
  );
}
