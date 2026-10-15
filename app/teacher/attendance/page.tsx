import { RoleGate } from "@/components/auth/role-gate";
import { TeacherAttendancePanel } from "@/components/teacher/teacher-attendance-panel";

export default function TeacherAttendancePage() {
  return <RoleGate allowedRole="TEACHER"><TeacherAttendancePanel /></RoleGate>;
}
