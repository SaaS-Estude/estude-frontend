import { MaterialPlanPracticePage } from "@/components/assessment/material-plan-practice-page";
import { RoleGate } from "@/components/auth/role-gate";

export default function Page() {
  return <RoleGate allowedRole="STUDENT"><MaterialPlanPracticePage /></RoleGate>;
}
