import { RoleGate } from "@/components/auth/role-gate";
import {
  LearningSupportScopeLoading,
  LearningSupportScopePage,
} from "@/components/assessment/learning-support-scope-page";

export default function TeacherLearningSupportScopeRoute() {
  return (
    <RoleGate
      allowedRole="TEACHER"
      loadingFallback={<LearningSupportScopeLoading />}
    >
      <LearningSupportScopePage />
    </RoleGate>
  );
}
