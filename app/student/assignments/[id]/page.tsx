import { RoleGate } from "@/components/auth/role-gate";
import { StudentShell } from "@/components/student/student-shell";
import { StudentAssignmentDetail } from "@/components/assignments/student-assignment";
export const metadata = { title: "Chi tiết bài tập" };
export default async function AssignmentRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentShell>
        <div className="p-6">
          <StudentAssignmentDetail id={id} />
        </div>
      </StudentShell>
    </RoleGate>
  );
}
