import { RoleGate } from "@/components/auth/role-gate";
import { QuestionBankPage } from "@/components/assessment/question-bank-page";

export default function TeacherQuestionBankRoute() {
  return <RoleGate allowedRole="TEACHER"><QuestionBankPage /></RoleGate>;
}
