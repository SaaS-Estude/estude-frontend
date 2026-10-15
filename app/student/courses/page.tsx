import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentCoursesPage } from "@/components/student/student-course-pages";

export const metadata: Metadata = {
  title: "Môn học của tôi",
  description: "Danh sách môn học và lớp được phân công cho sinh viên.",
};

export default function StudentCoursesRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentCoursesPage />
    </RoleGate>
  );
}
