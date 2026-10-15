import { RoleGate } from "@/components/auth/role-gate";
import { TeacherLearningPlanPage } from "@/components/assessment/teacher-learning-plan-page";

export default function Page() { return <RoleGate allowedRole="TEACHER"><TeacherLearningPlanPage /></RoleGate>; }
