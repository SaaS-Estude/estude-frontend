import { RoleGate } from "@/components/auth/role-gate";
import { ExamDetailPage } from "@/components/assessment/exam-pages";

export default function ExamDetailRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamDetailPage /></RoleGate>;
}
