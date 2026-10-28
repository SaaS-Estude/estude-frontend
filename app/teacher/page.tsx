import { portalRedirect as redirect } from '@/lib/portal-redirect';

export default async function TeacherPage() {
  return redirect('/teacher/dashboard');
}
