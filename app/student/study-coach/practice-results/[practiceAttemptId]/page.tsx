import { RoleGate } from "@/components/auth/role-gate";
import { StudentPracticeAttemptResultPage } from "@/components/student/student-practice-attempt-result-page";

export default function StudentPracticeAttemptResultRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentPracticeAttemptResultPage />
    </RoleGate>
  );
}
