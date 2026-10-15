import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentGradesPage } from "@/components/student/student-grades-page";

export const metadata: Metadata = {
  title: "Điểm số của tôi",
  description: "Theo dõi điểm số theo năm học, học kỳ, lớp và môn học.",
};

export default function StudentGradesRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentGradesPage />
    </RoleGate>
  );
}
