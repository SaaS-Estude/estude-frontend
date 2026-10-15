import { RoleGate } from "@/components/auth/role-gate";
import { SubjectSupportPage } from "@/components/assessment/subject-support-page";

export default function SubjectSupportRoute() {
  return <RoleGate allowedRole="TEACHER"><SubjectSupportPage /></RoleGate>;
}
