import { RoleGate } from "@/components/auth/role-gate";
import { AiQuestionGeneratorPage } from "@/components/assessment/ai-question-generator-page";

export default function GenerateQuestionRoute() {
  return <RoleGate allowedRole="TEACHER"><AiQuestionGeneratorPage /></RoleGate>;
}
