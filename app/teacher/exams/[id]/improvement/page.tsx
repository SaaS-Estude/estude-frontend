import { RoleGate } from "@/components/auth/role-gate";
import { ClassImprovementPage } from "@/components/assessment/class-improvement-page";

export default function Page() { return <RoleGate allowedRole="TEACHER"><ClassImprovementPage /></RoleGate>; }
