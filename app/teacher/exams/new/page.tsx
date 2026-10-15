import { RoleGate } from "@/components/auth/role-gate";
import { ExamWizardPage } from "@/components/assessment/exam-pages";

export default function NewExamRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamWizardPage /></RoleGate>;
}
