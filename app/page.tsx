import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPortalFromHost, isDevelopmentHome } from '@/lib/portal';
import { LandingPage } from '@/components/marketing/landing-page';
import { AboutPage } from '@/components/marketing/about-page';

export default async function HomePage() {
  if (isDevelopmentHome()) return <AboutPage />;

  const roleHome = {
    ADMIN: '/admin/login',
    TEACHER: '/teacher/login',
    STUDENT: '/login',
    PARENT: '/parent/login',
  } as const;
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const portal = getPortalFromHost(host);
  const role = portal?.toUpperCase() ?? process.env.ESTUDE_APP_ROLE;

  if (!role) return <LandingPage />;
  redirect(roleHome[role as keyof typeof roleHome] ?? '/login');
}
