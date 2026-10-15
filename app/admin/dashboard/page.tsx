import type { Metadata } from 'next';
import { RoleGate } from '@/components/auth/role-gate';
import { StaffDashboardView } from '@/components/dashboard/staff-dashboard-view';

export const metadata: Metadata = {
  title: 'Khu vực quản trị',
  description: 'Không gian điều hành dành cho quản trị viên EStude.',
};

export default function AdminDashboardPage() {
  return (
    <RoleGate allowedRole="ADMIN">
      <StaffDashboardView />
    </RoleGate>
  );
}
