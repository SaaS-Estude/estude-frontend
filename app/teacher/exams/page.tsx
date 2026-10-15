import { RoleGate } from "@/components/auth/role-gate";
import { TeacherExamsPage } from "@/components/assessment/exam-pages";

export default function TeacherExamsRoute() {
  return <RoleGate allowedRole="TEACHER"><TeacherExamsPage /></RoleGate>;
}
