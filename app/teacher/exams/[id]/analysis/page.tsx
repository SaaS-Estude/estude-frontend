import { ExamAnalysisPage } from "@/components/assessment/exam-analysis-page";
import { RoleGate } from "@/components/auth/role-gate";

export default function ExamAnalysisRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamAnalysisPage /></RoleGate>;
}
