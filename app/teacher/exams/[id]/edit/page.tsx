import { RoleGate } from "@/components/auth/role-gate";
import { ExamEditPage } from "@/components/assessment/exam-pages";

export default function EditExamRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamEditPage /></RoleGate>;
}
