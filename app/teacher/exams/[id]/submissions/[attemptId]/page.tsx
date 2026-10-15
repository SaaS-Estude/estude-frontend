import { RoleGate } from "@/components/auth/role-gate";
import { SubmissionDetailPage } from "@/components/assessment/submissions-page";

export default function SubmissionDetailRoute() {
  return <RoleGate allowedRole="TEACHER"><SubmissionDetailPage /></RoleGate>;
}
