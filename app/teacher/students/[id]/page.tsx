import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Chi tiết học sinh",
  description: "Thông tin học tập của học sinh thuộc lớp được phân công.",
};

export default function TeacherStudentDetailPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <StaffDashboardView />
    </RoleGate>
  );
}
