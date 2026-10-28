import { portalRedirect as redirect } from '@/lib/portal-redirect';

export default async function StudentPage() {
  return redirect('/student/dashboard');
}
