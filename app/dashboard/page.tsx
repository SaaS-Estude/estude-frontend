import type { Metadata } from 'next';
import { RoleRedirect } from '@/components/auth/role-redirect';

export const metadata: Metadata = {
  title: 'Tổng quan',
  description: 'Không gian học tập cá nhân trên EStude.',
};

export default function DashboardPage() {
  return <RoleRedirect />;
}
