import { RoleGate } from "@/components/auth/role-gate";
import { QuestionEditorPage } from "@/components/assessment/question-editor-page";

export default function EditQuestionRoute() {
  return <RoleGate allowedRole="TEACHER"><QuestionEditorPage /></RoleGate>;
}
