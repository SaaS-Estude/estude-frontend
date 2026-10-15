import { RoleGate } from "@/components/auth/role-gate";
import { SubmissionsPage } from "@/components/assessment/submissions-page";

export default function ExamSubmissionsRoute() {
  return <RoleGate allowedRole="TEACHER"><SubmissionsPage /></RoleGate>;
}
