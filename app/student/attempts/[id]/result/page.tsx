import { RoleGate } from "@/components/auth/role-gate";
import { StudentResultPage } from "@/components/assessment/student-exam-pages";

export default function StudentResultRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentResultPage /></RoleGate>;
}
