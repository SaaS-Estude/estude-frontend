import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Lớp học được phân công",
  description: "Quản lý các lớp và học viên thuộc môn học được phân công.",
};

export default function TeacherClassesPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <StaffDashboardView />
    </RoleGate>
  );
}
