import type { Metadata } from 'next';
import { AdminLoginForm } from '@/components/auth/admin-login-form';

export const metadata: Metadata = {
  title: 'Đăng nhập quản trị',
  description: 'Đăng nhập vào khu vực quản trị EStude.',
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
