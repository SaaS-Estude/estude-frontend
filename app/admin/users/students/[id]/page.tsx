import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Chi tiết học sinh",
  description: "Hồ sơ và kết quả học tập chi tiết của học sinh EStude.",
};

export default function AdminStudentDetailPage() {
  return (
    <RoleGate allowedRole="ADMIN">
      <StaffDashboardView />
    </RoleGate>
  );
}
