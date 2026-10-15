import { RoleGate } from "@/components/auth/role-gate";
import { QuestionEditorPage } from "@/components/assessment/question-editor-page";

export default function NewQuestionRoute() {
  return <RoleGate allowedRole="TEACHER"><QuestionEditorPage /></RoleGate>;
}
