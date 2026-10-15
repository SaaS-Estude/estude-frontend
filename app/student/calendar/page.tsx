import { RoleGate } from '@/components/auth/role-gate';
import { StudentCalendarPage } from '@/components/student/student-calendar-page';

export const metadata = { title: 'Lịch học tập' };

export default function CalendarPage() {
  return <RoleGate allowedRole="STUDENT"><StudentCalendarPage /></RoleGate>;
}
