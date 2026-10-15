import { RoleGate } from "@/components/auth/role-gate";
import { TeacherEngagementCenter } from "@/components/teacher/engagement-center";

export default function TeacherNotificationsPage() {
  return <RoleGate allowedRole="TEACHER"><TeacherEngagementCenter mode="message" /></RoleGate>;
}
