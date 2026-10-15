import { RoleGate } from "@/components/auth/role-gate";
import { StudentActivityPage } from "@/components/student/student-activity-page";

export default function StudentActivityRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentActivityPage /></RoleGate>;
}
