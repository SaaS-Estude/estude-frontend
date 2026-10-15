import type { Metadata } from 'next';
import { RoleGate } from '@/components/auth/role-gate';
import { SessionManagerView } from '@/components/auth/session-manager-view';

export const metadata: Metadata = { title: 'Phiên đăng nhập' };

export default function TeacherSessionsPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <SessionManagerView />
    </RoleGate>
  );
}
