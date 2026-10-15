import { RoleGate } from "@/components/auth/role-gate";
import { StudentAttemptPage } from "@/components/assessment/student-exam-pages";

export default function StudentAttemptRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentAttemptPage /></RoleGate>;
}
