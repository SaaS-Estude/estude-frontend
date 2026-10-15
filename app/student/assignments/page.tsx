import { RoleGate } from "@/components/auth/role-gate";
import { StudentShell } from "@/components/student/student-shell";
import { StudentAssignmentList } from "@/components/assignments/student-assignment";
export const metadata = { title: "Bài tập của tôi" };
export default function AssignmentsRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentShell>
        <div className="space-y-5 p-6">
          <h1 className="text-2xl font-bold">Bài tập của tôi</h1>
          <StudentAssignmentList />
        </div>
      </StudentShell>
    </RoleGate>
  );
}
