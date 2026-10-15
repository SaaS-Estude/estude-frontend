import { RoleGate } from "@/components/auth/role-gate";
import { StudentLearningPlansPage } from "@/components/assessment/student-learning-plans-page";

export default function Page() { return <RoleGate allowedRole="STUDENT"><StudentLearningPlansPage /></RoleGate>; }
