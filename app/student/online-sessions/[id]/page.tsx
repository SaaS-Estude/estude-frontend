import { RoleGate } from "@/components/auth/role-gate";
import { StudentOnlineSessionPage } from "@/components/online-sessions/student-session-page";
export const metadata = { title: "Buổi học online" };
export default function Page() { return <RoleGate allowedRole="STUDENT"><StudentOnlineSessionPage /></RoleGate>; }
