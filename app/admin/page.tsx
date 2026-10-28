import { portalRedirect as redirect } from '@/lib/portal-redirect';

export default async function AdminPage() {
  return redirect('/admin/dashboard');
}
