import type { Metadata } from 'next';
import { RoleGate } from '@/components/auth/role-gate';
import { StaffDashboardView } from '@/components/dashboard/staff-dashboard-view';

export const metadata: Metadata = {
  title: 'Lịch học giảng viên',
  description: 'Theo dõi thời khóa biểu và các lớp học được phân công.',
};

export default function TeacherDashboardPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <StaffDashboardView />
    </RoleGate>
  );
}
