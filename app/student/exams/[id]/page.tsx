import { StudentExamDetailPage } from "@/components/assessment/student-exam-pages";
import { RoleGate } from "@/components/auth/role-gate";

export default function StudentExamDetailRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentExamDetailPage /></RoleGate>;
}
