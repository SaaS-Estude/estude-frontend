import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export const metadata: Metadata = {
  title: "Học sinh đang quản lý",
  description: "Danh sách học sinh thuộc các lớp giáo viên được phân công.",
};

export default function TeacherStudentsPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <StaffDashboardView />
    </RoleGate>
  );
}
