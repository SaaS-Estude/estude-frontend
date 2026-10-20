import type { Metadata } from 'next';
import { RoleGate } from '@/components/auth/role-gate';
import { StudentDashboardView } from '@/components/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Không gian học sinh',
  description: 'Theo dõi và thực hiện các bài kiểm tra được giao.',
};

export default function StudentDashboardPage() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentDashboardView />
    </RoleGate>
  );
}
