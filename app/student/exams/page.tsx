import { StudentExamCatalogPage } from "@/components/assessment/student-exam-pages";
import { RoleGate } from "@/components/auth/role-gate";

export default function StudentExamsRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentExamCatalogPage /></RoleGate>;
}
