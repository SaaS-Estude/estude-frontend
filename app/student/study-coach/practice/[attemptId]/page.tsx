import { RoleGate } from "@/components/auth/role-gate";
import { StudentExamPracticePage } from "@/components/student/student-exam-practice-page";

export default function StudentStudyCoachPracticeRoute() {
  return <RoleGate allowedRole="STUDENT"><StudentExamPracticePage /></RoleGate>;
}
