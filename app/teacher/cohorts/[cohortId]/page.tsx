import { LearningSupportCohortDetailPage } from "@/components/assessment/learning-support-cohort-detail-page";
import { RoleGate } from "@/components/auth/role-gate";

export default function TeacherLearningSupportCohortRoute() {
  return (
    <RoleGate allowedRole="TEACHER">
      <LearningSupportCohortDetailPage />
    </RoleGate>
  );
}
